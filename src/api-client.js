const core = require('@actions/core')
const github = require('@actions/github')
const hc = require('@actions/http-client')
const { RequestError } = require('@octokit/request-error')
const HttpStatusMessages = require('http-status-messages')

// All variables we need from the runtime are loaded here
const getContext = require('./context')

// Mostly a lift from https://github.com/octokit/request.js/blob/bd72b7be53ab16a6c1c44be99eb73a328fb1e9e4/src/fetch-wrapper.ts#L151-L165
// Minor revisions applied.
function toErrorMessage(data) {
  if (typeof data === 'string') return data

  if (data != null && 'message' in data) {
    if (Array.isArray(data.errors)) {
      return `${data.message}: ${data.errors.map(JSON.stringify).join(', ')}`
    }
    return data.message
  }

  // Defer back to the caller
  return null
}

async function getSignedArtifactUrl({ runtimeToken, workflowRunId, artifactName }) {
  const { runTimeUrl: RUNTIME_URL } = getContext()
  const artifactExchangeUrl = `${RUNTIME_URL}_apis/pipelines/workflows/${workflowRunId}/artifacts?api-version=6.0-preview`

  const httpClient = new hc.HttpClient()
  let data = null

  try {
    core.info(`Artifact exchange URL: ${artifactExchangeUrl}`)
    const requestHeaders = {
      accept: 'application/json',
      authorization: `Bearer ${runtimeToken}`
    }
    const res = await httpClient.get(artifactExchangeUrl, requestHeaders)

    // Parse the response body as JSON
    let obj = null
    try {
      const contents = await res.readBody()
      if (contents && contents.length > 0) {
        obj = JSON.parse(contents)
      }
    } catch (error) {
      // Invalid resource (contents not json);  leaving result obj null
    }

    // Specific response shape aligned with Octokit
    const response = {
      url: res.message.url || artifactExchangeUrl,
      status: res.message.statusCode || 0,
      headers: {
        ...res.message?.headers
      },
      data: obj
    }

    // Forcibly throw errors for negative HTTP status codes!
    // @actions/http-client doesn't do this by default.
    // Mimic the errors thrown by Octokit for consistency.
    if (response.status >= 400) {
      throw new RequestError(
        toErrorMessage(response.data) ||
          res.message?.statusMessage ||
          HttpStatusMessages[response.status] ||
          'Unknown error',
        response.status,
        {
          response,
          request: {
            method: 'GET',
            url: artifactExchangeUrl,
            headers: {
              ...requestHeaders
            },
            body: null
          }
        }
      )
    }

    data = response.data
    core.debug(JSON.stringify(data))
  } catch (error) {
    core.error('Getting signed artifact URL failed', error)
    throw error
  }

  const artifactRawUrl = data?.value?.find(artifact => artifact.name === artifactName)?.url
  if (!artifactRawUrl) {
    throw new Error(
      'No uploaded artifact was found! Please check if there are any errors at build step, or uploaded artifact name is correct.'
    )
  }

  const signedArtifactUrl = `${artifactRawUrl}&%24expand=SignedContent`
  return signedArtifactUrl
}

async function createPagesDeployment({ githubToken, artifactUrl, buildVersion, idToken, isPreview = false }) {
  const octokit = github.getOctokit(githubToken)

  const payload = {
    artifact_url: artifactUrl,
    pages_build_version: buildVersion,
    oidc_token: idToken
  }
  if (isPreview === true) {
    payload.preview = true
  }
  core.info(`Creating Pages deployment with payload:\n${JSON.stringify(payload, null, '\t')}`)

  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/pages/deployment', {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      ...payload
    })

    return response.data
  } catch (error) {
    core.error('Creating Pages deployment failed', error)
    throw error
  }
}

async function getPagesDeploymentStatus({ githubToken, deploymentId }) {
  const octokit = github.getOctokit(githubToken)

  core.info('Getting Pages deployment status...')
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/pages/deployment/status/{deploymentId}', {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      deploymentId
    })

    return response.data
  } catch (error) {
    core.error('Getting Pages deployment status failed', error)
    throw error
  }
}

async function cancelPagesDeployment({ githubToken, deploymentId }) {
  const octokit = github.getOctokit(githubToken)

  core.info('Canceling Pages deployment...')
  try {
    const response = await octokit.request('PUT /repos/{owner}/{repo}/pages/deployment/cancel/{deploymentId}', {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      deploymentId
    })

    return response.data
  } catch (error) {
    core.error('Canceling Pages deployment failed', error)
    throw error
  }
}

module.exports = {
  getSignedArtifactUrl,
  createPagesDeployment,
  getPagesDeploymentStatus,
  cancelPagesDeployment
}
