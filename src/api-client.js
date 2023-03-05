const core = require('@actions/core')
const github = require('@actions/github')
const hc = require('@actions/http-client')

// All variables we need from the runtime are loaded here
const getContext = require('./context')

async function getSignedArtifactUrl({ runtimeToken, workflowRunId, artifactName }) {
  const { runTimeUrl: RUNTIME_URL } = getContext()
  const artifactExchangeUrl = `${RUNTIME_URL}_apis/pipelines/workflows/${workflowRunId}/artifacts?api-version=6.0-preview`

  const httpClient = new hc.HttpClient()
  let data = null

  try {
    core.info(`Artifact exchange URL: ${artifactExchangeUrl}`)
    const response = await httpClient.getJson(artifactExchangeUrl, {
      Authorization: `Bearer ${runtimeToken}`
    })

    data = response?.result
    core.info(JSON.stringify(data))
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
