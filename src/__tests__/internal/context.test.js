const core = require('@actions/core')
const getContext = require('../../internal/context')

describe('getContext', () => {
  beforeEach(() => {
    process.env.ACTIONS_RUNTIME_URL = 'http://my-url'
    process.env.GITHUB_RUN_ID = '123'
    process.env.ACTIONS_RUNTIME_TOKEN = 'a-token'
    process.env.GITHUB_REPOSITORY = 'actions/is-awesome'
    process.env.GITHUB_TOKEN = 'gha-token'
    process.env.GITHUB_SHA = '123abc'
    process.env.GITHUB_ACTOR = 'monalisa'
    process.env.GITHUB_ACTION = '__monalisa/octocat'
    process.env.GITHUB_ACTION_PATH = 'something'

    // Mock debug
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())
  })

  it('succeeds with all environment variables set', () => {
    const context = getContext()
    expect(context).toEqual({
      actionsId: '__monalisa/octocat',
      artifactName: 'github-pages',
      buildActor: 'monalisa',
      buildVersion: '123abc',
      githubApiUrl: 'https://api.github.com',
      githubServerUrl: 'https://github.com',
      githubToken: '',
      isPreview: false,
      repositoryNwo: 'actions/is-awesome',
      runTimeToken: 'a-token',
      runTimeUrl: 'http://my-url',
      workflowRun: '123'
    })
    expect(core.debug).toHaveBeenCalledWith('all variables are set')
  })

  it('throws if there are missing variables', () => {
    delete process.env.ACTIONS_RUNTIME_URL
    expect(getContext).toThrow('runTimeUrl is undefined. Cannot continue.')
  })
})
