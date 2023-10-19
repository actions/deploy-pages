const core = require('@actions/core')

const stateKeys = require('./internal/state-keys')
const { Deployment } = require('./internal/deployment')

async function cleanup() {
  const deploymentId = core.getState(stateKeys.id)
  const isPending = core.getState(stateKeys.isPending) === 'true'

  if (!deploymentId) {
    core.info(`Deployment ID was missing, cannot attempt cleanup...`)
    return
  }

  if (!isPending) {
    core.info(`Deployment ${deploymentId} is not pending, will not attempt cleanup...`)
    return
  }

  core.info(`Cleanup: Attempting to cancel deployment ${deploymentId}...`)

  const deployment = new Deployment()

  // Internal hack to allow us to cancel the deployment if the action is cancelled
  deployment.deploymentInfo = {
    ...deployment,
    id: deploymentId || deployment.buildVersion,
    pending: true
  }

  try {
    await deployment.cancel()
  } catch (error) {
    core.warning(`Failed to cancel deployment ${deploymentId}: ${error.message}`)
    // Exit cleanly anyway
    return
  }
}

cleanup()
