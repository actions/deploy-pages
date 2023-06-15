const core = require('@actions/core')

// All variables we need from the runtime are loaded here
const getContext = require('./context')
const {
  getSignedArtifactMetadata,
  createPagesDeployment,
  getPagesDeploymentStatus,
  cancelPagesDeployment
} = require('./api-client')

const temporaryErrorStatus = {
  unknown_status: 'Unable to get deployment status.',
  not_found: 'Deployment not found.',
  deployment_attempt_error: 'Deployment temporarily failed, a retry will be automatically scheduled...'
}

const finalErrorStatus = {
  deployment_failed: 'Deployment failed, try again later.',
  deployment_content_failed:
    'Artifact could not be deployed. Please ensure the content does not contain any hard links, symlinks and total size is less than 10GB.',
  deployment_cancelled: 'Deployment cancelled.',
  deployment_lost: 'Deployment failed to report final status.'
}

const MAX_TIMEOUT = 600000
const ONE_GIGABYTE = 1073741824
const SIZE_LIMIT_DESCRIPTION = '1 GB'

class Deployment {
  constructor() {
    const context = getContext()
    this.runTimeUrl = context.runTimeUrl
    this.repositoryNwo = context.repositoryNwo
    this.runTimeToken = context.runTimeToken
    this.buildVersion = context.buildVersion
    this.buildActor = context.buildActor
    this.actionsId = context.actionsId
    this.githubToken = context.githubToken
    this.workflowRun = context.workflowRun
    this.deploymentInfo = null
    this.githubApiUrl = context.githubApiUrl
    this.githubServerUrl = context.githubServerUrl
    this.artifactName = context.artifactName
    this.isPreview = context.isPreview === true
    this.timeout = MAX_TIMEOUT
    this.startTime = null
    this.maxErrorCount = null
  }

  setOptionalUserInput() {
    const timeoutInput = Number(core.getInput('timeout'))
    if (timeoutInput > MAX_TIMEOUT) {
      core.warning(
        `Warning: timeout value is greater than the allowed maximum - timeout set to the maximum of ${MAX_TIMEOUT} milliseconds.`
      )
    }
    this.timeout = !timeoutInput || timeoutInput <= 0 ? MAX_TIMEOUT : Math.min(timeoutInput, MAX_TIMEOUT)

    const maxErrorCountInput = Number(core.getInput('error_count'))
    if (!maxErrorCountInput || maxErrorCountInput <= 0) {
      core.warning('Invalid error_count value will be ignored. Please ensure the value is a positive integer.')
    } else {
      this.maxErrorCount = maxErrorCountInput
    }
  }

  // Ask the runtime for the unsigned artifact URL and deploy to GitHub Pages
  // by creating a deployment with that artifact
  async create(idToken) {
    try {
      this.setOptionalUserInput()

      core.debug(`Actor: ${this.buildActor}`)
      core.debug(`Action ID: ${this.actionsId}`)
      core.debug(`Actions Workflow Run ID: ${this.workflowRun}`)

      const artifactData = await getSignedArtifactMetadata({
        runtimeToken: this.runTimeToken,
        workflowRunId: this.workflowRun,
        artifactName: this.artifactName
      })

      if (artifactData?.size > ONE_GIGABYTE) {
        core.warning(
          `Uploaded artifact size of ${artifactData?.size} bytes exceeds the allowed size of ${SIZE_LIMIT_DESCRIPTION}. Deployment might fail.`
        )
      }

      const deployment = await createPagesDeployment({
        githubToken: this.githubToken,
        artifactUrl: artifactData.url,
        buildVersion: this.buildVersion,
        idToken,
        isPreview: this.isPreview
      })

      if (deployment) {
        this.deploymentInfo = {
          ...deployment,
          id: deployment.id || deployment.status_url?.split('/')?.pop() || this.buildVersion,
          pending: true
        }
        this.startTime = Date.now()
      }

      core.info(`Created deployment for ${this.buildVersion}, ID: ${this.deploymentInfo?.id}`)

      core.debug(JSON.stringify(deployment))

      return deployment
    } catch (error) {
      core.error(error.stack)

      // output raw error in debug mode.
      core.debug(JSON.stringify(error))

      // build customized error message based on server response
      if (error.response) {
        let errorMessage = `Failed to create deployment (status: ${error.status}) with build version ${this.buildVersion}. `
        if (error.status === 400) {
          errorMessage += `Responded with: ${error.message}`
        } else if (error.status === 403) {
          errorMessage += 'Ensure GITHUB_TOKEN has permission "pages: write".'
        } else if (error.status === 404) {
          const pagesSettingsUrl = `${this.githubServerUrl}/${this.repositoryNwo}/settings/pages`
          errorMessage += `Ensure GitHub Pages has been enabled: ${pagesSettingsUrl}`
          // If using GHES, add a special note about compatibility
          if (new URL(this.githubServerUrl).hostname.toLowerCase() !== 'github.com') {
            errorMessage +=
              '\nNote: This action version may not yet support GitHub Enterprise Server, please check the compatibility table.'
          }
        } else if (error.status >= 500) {
          errorMessage +=
            'Server error, is githubstatus.com reporting a Pages outage? Please re-run the deployment at a later time.'
        }
        throw new Error(errorMessage)
      } else {
        // istanbul ignore next
        throw error
      }
    }
  }

  // Poll the deployment endpoint for status
  async check() {
    // Don't attempt to check status if no deployment was created
    if (!this.deploymentInfo) {
      core.setFailed(temporaryErrorStatus.not_found)
      return
    }
    if (this.deploymentInfo.pending !== true) {
      core.setFailed(temporaryErrorStatus.unknown_status)
      return
    }

    const deploymentId = this.deploymentInfo.id || this.buildVersion
    const reportingInterval = Number(core.getInput('reporting_interval'))

    let errorCount = 0

    // Time in milliseconds between two deployment status report when status errored, default 0.
    let errorReportingInterval = 0
    let deployment = null
    let errorStatus = 0

    /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
    while (true) {
      // Handle reporting interval
      await new Promise(resolve => setTimeout(resolve, reportingInterval + errorReportingInterval))

      // Check status
      try {
        deployment = await getPagesDeploymentStatus({
          githubToken: this.githubToken,
          deploymentId
        })

        if (deployment.status === 'succeed') {
          core.info('Reported success!')
          core.setOutput('status', 'succeed')
          this.deploymentInfo.pending = false
          break
        } else if (finalErrorStatus[deployment.status]) {
          // Fall into permanent error, it may be caused by ongoing incident, malicious deployment content, exhausted automatic retry times, invalid artifact, etc.
          core.setFailed(finalErrorStatus[deployment.status])
          this.deploymentInfo.pending = false
          break
        } else if (temporaryErrorStatus[deployment.status]) {
          // A temporary error happened, will query the status again
          core.warning(temporaryErrorStatus[deployment.status])
        } else {
          core.info('Current status: ' + deployment.status)
        }

        // reset the error reporting interval once get the proper status back.
        errorReportingInterval = 0
      } catch (error) {
        core.error(error.stack)

        // output raw error in debug mode.
        core.debug(JSON.stringify(error))

        // build customized error message based on server response
        if (error.response) {
          errorStatus = error.status || error.response.status

          errorCount++

          // set the maximum error reporting interval greater than 15 sec but below 30 sec.
          if (errorReportingInterval < 1000 * 15) {
            errorReportingInterval = (errorReportingInterval << 1) | 1
          }
        }
      }

      if (errorCount >= this.maxErrorCount) {
        core.error('Too many errors, aborting!')
        core.setFailed('Failed with status code: ' + errorStatus)

        // Explicitly cancel the deployment
        await this.cancel()
        return
      }

      // Handle timeout
      if (Date.now() - this.startTime >= this.timeout) {
        core.error('Timeout reached, aborting!')
        core.setFailed('Timeout reached, aborting!')

        // Explicitly cancel the deployment
        await this.cancel()
        return
      }
    }
  }

  async cancel() {
    // Don't attempt to cancel if no deployment was created
    if (!this.deploymentInfo || this.deploymentInfo.pending !== true) {
      core.debug('No deployment to cancel')
      return
    }

    // Cancel the deployment
    try {
      const deploymentId = this.deploymentInfo.id || this.buildVersion
      await cancelPagesDeployment({
        githubToken: this.githubToken,
        deploymentId
      })
      core.info(`Canceled deployment with ID ${deploymentId}`)

      this.deploymentInfo.pending = false
    } catch (error) {
      core.setFailed(error)
      if (error.response?.data) {
        core.error(JSON.stringify(error.response.data))
      }
    }
  }
}

module.exports = { Deployment, MAX_TIMEOUT, ONE_GIGABYTE, SIZE_LIMIT_DESCRIPTION }
