const core = require('@actions/core')

// Load variables from Actions runtime
function getRequiredVars() {
  return {
    runTimeUrl: process.env.ACTIONS_RUNTIME_URL,
    workflowRun: process.env.GITHUB_RUN_ID,
    runTimeToken: process.env.ACTIONS_RUNTIME_TOKEN,
    repositoryNwo: process.env.GITHUB_REPOSITORY,
    buildVersion: process.env.GITHUB_SHA,
    buildActor: process.env.GITHUB_ACTOR,
    actionsId: process.env.GITHUB_ACTION,
    githubToken: core.getInput('token')
  }
}

module.exports = function getContext() {
  const requiredVars = getRequiredVars()
  for (const variable in requiredVars) {
    if (requiredVars[variable] === undefined) {
      throw new Error(`${variable} is undefined. Cannot continue.`)
    }
  }
  core.debug('all variables are set')
  return requiredVars
}
