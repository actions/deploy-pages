const core = require('@actions/core')
const axios = require('axios')
const { HttpsProxyAgent } = require('https-proxy-agent')

// All variables we need from the runtime are loaded here
const getContext = require('./context')

const errorStatus = {
  unknown_status: 'Unable to get deployment status.',
  not_found: 'Deployment not found.',
  deployment_attempt_error: 'Deployment temporarily failed, a retry will be automatically scheduled...'
}

class Deployment {
  constructor() {
    const context = getContext()
    this.runTimeUrl = context.runTimeUrl
    this.repositoryNwo = context.repositoryNwo
    this.runTimeToken = context.runTimeToken
    this.buildVersion = context.buildVersion
    this.buildActor = context.buildActor
    this.actionsId = context.workflowRun
    this.githubToken = context.githubToken
    this.workflowRun = context.workflowRun
    this.requestedDeployment = false
    this.deploymentInfo = null
    this.githubApiUrl = context.githubApiUrl
    this.githubServerUrl = context.githubServerUrl
    this.artifactName = context.artifactName
    this.isPreview = context.isPreview === true
    this.proxyOptions = context.proxy
      ? {
          httpsAgent: new HttpsProxyAgent(context.proxy),
          proxy: false
        }
      : {}
  }

  // Ask the runtime for the unsigned artifact URL and deploy to GitHub Pages
  // by creating a deployment with that artifact
  async create(idToken) {
    try {
      core.info(`Actor: ${this.buildActor}`)
      core.info(`Action ID: ${this.actionsId}`)
      const pagesDeployEndpoint = `${this.githubApiUrl}/repos/${this.repositoryNwo}/pages/deployment`
      const artifactExgUrl = `${this.runTimeUrl}_apis/pipelines/workflows/${this.workflowRun}/artifacts?api-version=6.0-preview`
      core.info(`Artifact URL: ${artifactExgUrl}`)
      const { data } = await axios.get(artifactExgUrl, {
        ...this.proxyOptions,
        headers: {
          Authorization: `Bearer ${this.runTimeToken}`,
          'Content-Type': 'application/json'
        }
      })
      core.info(JSON.stringify(data))
      const artifactRawUrl = data?.value?.find(artifact => artifact.name === this.artifactName)?.url
      if (!artifactRawUrl) {
        throw new Error(
          'No uploaded artifact was found! Please check if there are any errors at build step, or uploaded artifact name is correct.'
        )
      }

      const artifactUrl = `${artifactRawUrl}&%24expand=SignedContent`
      const payload = {
        artifact_url: artifactUrl,
        pages_build_version: this.buildVersion,
        oidc_token: idToken
      }
      if (this.isPreview === true) {
        payload.preview = true
      }
      core.info(`Creating deployment with payload:\n${JSON.stringify(payload, null, '\t')}`)
      const response = await axios.post(pagesDeployEndpoint, payload, {
        ...this.proxyOptions,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${this.githubToken}`,
          'Content-type': 'application/json'
        }
      })
      this.requestedDeployment = true
      core.info(`Created deployment for ${this.buildVersion}`)
      if (response && response.data) {
        core.info(JSON.stringify(response.data))
        this.deploymentInfo = response.data
      }
    } catch (error) {
      core.info(error.stack)

      // output raw error in debug mode.
      core.debug(JSON.stringify(error))

      // build customized error message based on server response
      if (error.response) {
        let errorMessage = `Failed to create deployment (status: ${error.response.status}) with build version ${this.buildVersion}. `
        if (error.response.status == 400) {
          let message = ''
          if (error.response.data && error.response.data.message) {
            message = error.response.data.message
          } else {
            message = error.response.data
          }
          errorMessage += `Responded with: ${message}`
        } else if (error.response.status == 403) {
          errorMessage += `Ensure GITHUB_TOKEN has permission "pages: write".`
        } else if (error.response.status == 404) {
          const pagesSettingsUrl = `${this.githubServerUrl}/${this.repositoryNwo}/settings/pages`
          errorMessage += `Ensure GitHub Pages has been enabled: ${pagesSettingsUrl}`
        } else if (error.response.status >= 500) {
          errorMessage += `Server error, is githubstatus.com reporting a Pages outage? Please re-run the deployment at a later time.`
        }
        throw errorMessage
      } else {
        throw error
      }
    }
  }

  // Poll the deployment endpoint for status
  async check() {
    try {
      const statusUrl =
        this.deploymentInfo != null
          ? this.deploymentInfo['status_url']
          : `${this.githubApiUrl}/repos/${this.repositoryNwo}/pages/deployment/status/${this.buildVersion}`
      let pageUrl = this.deploymentInfo != null ? this.deploymentInfo['page_url'] : ''
      const previewUrl = this.deploymentInfo != null ? this.deploymentInfo['preview_url'] : ''
      if (this.isPreview && previewUrl) {
        pageUrl = previewUrl
      }
      core.setOutput('page_url', pageUrl)
      const timeout = Number(core.getInput('timeout'))
      const reportingInterval = Number(core.getInput('reporting_interval'))
      const maxErrorCount = Number(core.getInput('error_count'))
      var startTime = Date.now()
      var errorCount = 0

      // Time in milliseconds between two deployment status report when status errored, default 0.
      var errorReportingInterval = 0

      /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
      while (true) {
        // Handle reporting interval
        await new Promise(r => setTimeout(r, reportingInterval + errorReportingInterval))

        // Check status
        var res = await axios.get(statusUrl, {
          ...this.proxyOptions,
          headers: {
            Authorization: `token ${this.githubToken}`
          }
        })

        if (res.data.status == 'succeed') {
          core.info('Reported success!')
          core.setOutput('status', 'succeed')
          break
        } else if (res.data.status == 'deployment_failed') {
          // Fall into permanent error, it may be caused by ongoing incident or malicious deployment content or exhausted automatic retry times.
          core.setFailed('Deployment failed, try again later.')
          break
        } else if (res.data.status == 'deployment_content_failed') {
          // The uploaded artifact is invalid.
          core.setFailed(
            'Artifact could not be deployed. Please ensure the content does not contain any hard links, symlinks and total size is less than 10GB.'
          )
          break
        } else if (errorStatus[res.data.status]) {
          // A temporary error happened, will query the status again
          core.info(errorStatus[res.data.status])
        } else {
          core.info('Current status: ' + res.data.status)
        }

        if (res.status != 200 || !!errorStatus[res.data.status]) {
          errorCount++

          // set the Maximum error reporting interval greater than 15 sec but below 30 sec.
          if (errorReportingInterval < 1000 * 15) {
            errorReportingInterval = (errorReportingInterval << 1) | 1
          }
        } else {
          // reset the error reporting interval once get the proper status back.
          errorReportingInterval = 0
        }

        if (errorCount >= maxErrorCount) {
          core.info('Too many errors, aborting!')
          core.setFailed('Failed with status code: ' + res.status)

          // Explicitly cancel the deployment
          await this.cancel()
          return
        }

        // Handle timeout
        if (Date.now() - startTime >= timeout) {
          core.info('Timeout reached, aborting!')
          core.setFailed('Timeout reached, aborting!')

          // Explicitly cancel the deployment
          await this.cancel()
          return
        }
      }
    } catch (error) {
      core.setFailed(error)
      if (error.response && error.response.data) {
        core.info(JSON.stringify(error.response.data))
      }
    }
  }

  async cancel() {
    // Don't attemp to cancel if no deployment was created
    if (!this.requestedDeployment) {
      return
    }

    // Cancel the deployment
    try {
      const pagesCancelDeployEndpoint = `${this.githubApiUrl}/repos/${this.repositoryNwo}/pages/deployment/cancel/${this.buildVersion}`
      await axios.put(
        pagesCancelDeployEndpoint,
        {},
        {
          ...this.proxyOptions,
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${this.githubToken}`,
            'Content-type': 'application/json'
          }
        }
      )
      core.info(`Deployment cancelled with ${pagesCancelDeployEndpoint}`)
    } catch (error) {
      core.setFailed(error)
      if (error.response && error.response.data) {
        core.info(JSON.stringify(error.response.data))
      }
    }
  }
}
module.exports = { Deployment }
