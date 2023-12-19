const core = require('@actions/core')
const github = require('@actions/github')
const { DefaultArtifactClient } = require('@actions/artifact')

async function getArtifactMetadata({ artifactName }) {
  const artifactClient = new DefaultArtifactClient()

  try {
    core.info(`Fetching artifact metadata for ${artifactName} in this workflow run`)

    const response = await artifactClient.listArtifacts()

    const filteredArtifacts = response.artifacts.filter(artifact => artifact.name === artifactName)

    const artifactCount = filteredArtifacts.length
    core.debug(`List artifact count: ${artifactCount}`)

    if (artifactCount === 0) {
      throw new Error(
        'No artifacts found for this workflow run. Ensure artifacts are uploaded with actions/artifact@v4 or later.'
      )
    } else if (artifactCount > 1) {
      throw new Error(
        `Multiple artifacts unexpectedly found for this workflow run. Artifact count is ${artifactCount}.`
      )
    }

    const artifact = filteredArtifacts[0]
    core.debug(`Artifact: ${JSON.stringify(artifact)}`)

    if (!artifact.size) {
      core.warning('Artifact size was not found. Unable to verify if artifact size exceeds the allowed size.')
    }

    return artifact
  } catch (error) {
    core.error(
      'Fetching artifact metadata failed. Is githubstatus.com reporting issues with API requests, Pages or Actions? Please re-run the deployment at a later time.',
      error
    )
    throw error
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
  createPagesDeployment,
  getPagesDeploymentStatus,
  cancelPagesDeployment
}
