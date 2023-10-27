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

async function getArtifactMetadata({ githubToken, runId, artifactName }) {
  const octokit = github.getOctokit(githubToken)

  try {
    core.info(`Fetching artifact metadata for ${artifactName} in run ${runId}`)

    const response = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts?name={artifactName}", {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      run_id: runId,
      artifactName: artifactName
    })

    const artifactCount = response.data.total_count
    core.debug(`List artifact count: ${artifactCount}`)

    if (artifactCount === 0) {
      throw new Error(`No artifacts found for workflow run ${runId}. Ensure artifacts are uploaded with actions/artifact@v4 or later.`)
    } else if (artifactCount > 1) {
      throw new Error(`Multiple artifact unexpectedly found for workflow run ${runId}. Artifact count is ${artifactCount}.`)
    }
    
    const artifact = response.data.artifacts[0]
    core.debug(`Artifact: ${JSON.stringify(artifact)}`)

    const artifactSize = artifact.size_in_bytes
    if (!artifactSize) {
      core.warning('Artifact size was not found. Unable to verify if artifact size exceeds the allowed size.')
    }
  
    return {
      id: artifact.id,
      size: artifactSize
    }
  } catch (error) {
    core.error('Fetching artifact metadata failed', error)
    throw error
  }
}

async function getSignedArtifactMetadata({ runtimeToken, workflowRunId, artifactName }) {
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

  const artifact = data?.value?.find(artifact => artifact.name === artifactName)
  const artifactRawUrl = artifact?.url
  if (!artifactRawUrl) {
    throw new Error(
      'No uploaded artifact was found! Please check if there are any errors at build step, or uploaded artifact name is correct.'
    )
  }

  const signedArtifactUrl = `${artifactRawUrl}&%24expand=SignedContent`

  const artifactSize = artifact?.size
  if (!artifactSize) {
    core.warning('Artifact size was not found. Unable to verify if artifact size exceeds the allowed size.')
  }

  return {
    url: signedArtifactUrl,
    size: artifactSize
  }
}

async function createPagesDeployment({ githubToken, artifactId, buildVersion, idToken, isPreview = false }) {
  const octokit = github.getOctokit(githubToken)

  const payload = {
    artifact_id: artifactId,
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
  getArtifactMetadata,
  getSignedArtifactMetadata,
  createPagesDeployment,
  getPagesDeploymentStatus,
  cancelPagesDeployment
}
