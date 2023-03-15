const core = require('@actions/core')
const github = require('@actions/github')
const hc = require('@actions/http-client')
const { RequestError } = require('@octokit/request-error')
const HttpStatusMessages = require('http-status-messages')

// All variables we need from the runtime are loaded here
const getContext = require('./context')

async function processRuntimeResponse(res, requestOptions) {
  // Parse the response body as JSON
  let obj = null
  try {
    const contents = await res.readBody()
    if (contents && contents.length > 0) {
      obj = JSON.parse(contents)
    }
  } catch (error) {
    // Invalid resource (contents not json); leaving resulting obj as null
  }

  // Specific response shape aligned with Octokit
  const response = {
    url: res.message?.url || requestOptions.url,
    status: res.message?.statusCode || 0,
    headers: {
      ...res.message?.headers
    },
    data: obj
  }

  // Forcibly throw errors for negative HTTP status codes!
  // @actions/http-client doesn't do this by default.
  // Mimic the errors thrown by Octokit for consistency.
  if (response.status >= 400) {
    // Try to get an error message from the response body
    const errorMsg =
      (typeof response.data === 'string' && response.data) ||
      response.data?.error ||
      response.data?.message ||
      // Try the Node HTTP IncomingMessage's statusMessage property
      res.message?.statusMessage ||
      // Fallback to the HTTP status message based on the status code
      HttpStatusMessages[response.status] ||
      // Or if the status code is unexpected...
      `Unknown error (${response.status})`

    throw new RequestError(errorMsg, response.status, {
      response,
      request: requestOptions
    })
  }

  return response
}

async function getSignedArtifactUrl({ runtimeToken, workflowRunId, artifactName }) {
  const { runTimeUrl: RUNTIME_URL } = getContext()
  const artifactExchangeUrl = `${RUNTIME_URL}_apis/pipelines/workflows/${workflowRunId}/artifacts?api-version=6.0-preview`

  const httpClient = new hc.HttpClient()
  let data = null

  try {
    const requestHeaders = {
      accept: 'application/json',
      authorization: `Bearer ${runtimeToken}`
    }
    const requestOptions = {
      method: 'GET',
      url: artifactExchangeUrl,
      headers: {
        ...requestHeaders
      },
      body: null
    }

    core.info(`Artifact exchange URL: ${artifactExchangeUrl}`)
    const res = await httpClient.get(artifactExchangeUrl, requestHeaders)

    // May throw a RequestError (HttpError)
    const response = await processRuntimeResponse(res, requestOptions)

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
    const response = await octokit.request('POST /repos/{owner}/{repo}/pages/deployments', {
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
    const response = await octokit.request('GET /repos/{owner}/{repo}/pages/deployments/{deploymentId}', {
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
    const response = await octokit.request('POST /repos/{owner}/{repo}/pages/deployments/{deploymentId}/cancel', {
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
