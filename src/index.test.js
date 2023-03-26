const core = require('@actions/core')
const process = require('process')
const cp = require('child_process')
const path = require('path')
const nock = require('nock')

const { Deployment } = require('./deployment')

const fakeJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiNjllMWIxOC1jOGFiLTRhZGQtOGYxOC03MzVlMzVjZGJhZjAiLCJzdWIiOiJyZXBvOnBhcGVyLXNwYS9taW55aTplbnZpcm9ubWVudDpQcm9kdWN0aW9uIiwiYXVkIjoiaHR0cHM6Ly9naXRodWIuY29tL3BhcGVyLXNwYSIsInJlZiI6InJlZnMvaGVhZHMvbWFpbiIsInNoYSI6ImEyODU1MWJmODdiZDk3NTFiMzdiMmM0YjM3M2MxZjU3NjFmYWM2MjYiLCJyZXBvc2l0b3J5IjoicGFwZXItc3BhL21pbnlpIiwicmVwb3NpdG9yeV9vd25lciI6InBhcGVyLXNwYSIsInJ1bl9pZCI6IjE1NDY0NTkzNjQiLCJydW5fbnVtYmVyIjoiMzQiLCJydW5fYXR0ZW1wdCI6IjIiLCJhY3RvciI6IllpTXlzdHkiLCJ3b3JrZmxvdyI6IkNJIiwiaGVhZF9yZWYiOiIiLCJiYXNlX3JlZiI6IiIsImV2ZW50X25hbWUiOiJwdXNoIiwicmVmX3R5cGUiOiJicmFuY2giLCJlbnZpcm9ubWVudCI6IlByb2R1Y3Rpb24iLCJqb2Jfd29ya2Zsb3dfcmVmIjoicGFwZXItc3BhL21pbnlpLy5naXRodWIvd29ya2Zsb3dzL2JsYW5rLnltbEByZWZzL2hlYWRzL21haW4iLCJpc3MiOiJodHRwczovL3Rva2VuLmFjdGlvbnMuZ2l0aHVidXNlcmNvbnRlbnQuY29tIiwibmJmIjoxNjM4ODI4MDI4LCJleHAiOjE2Mzg4Mjg5MjgsImlhdCI6MTYzODgyODYyOH0.1wyupfxu1HGoTyIqatYg0hIxy2-0bMO-yVlmLSMuu2w'

describe('with all environment variables set', () => {
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
  })

  it('executes cleanly', done => {
    const ip = path.join(__dirname, './index.js')
    cp.exec(`node ${ip}`, { env: process.env }, (err, stdout) => {
      expect(stdout).toMatch(/::debug::all variables are set/)
      done()
    })
  })
})

describe('with variables missing', () => {
  it('execution fails if there are missing variables', done => {
    delete process.env.ACTIONS_RUNTIME_URL
    const ip = path.join(__dirname, './index.js')
    cp.exec(`node ${ip}`, { env: process.env }, (err, stdout) => {
      expect(stdout).toBe('')
      expect(err).toBeTruthy()
      expect(err.code).toBe(1)
      done()
    })
  })
})

describe('Deployment', () => {
  beforeEach(() => {
    process.env.ACTIONS_RUNTIME_URL = 'http://my-url/'
    process.env.GITHUB_RUN_ID = '123'
    process.env.ACTIONS_RUNTIME_TOKEN = 'a-token'
    process.env.GITHUB_REPOSITORY = 'actions/is-awesome'
    process.env.GITHUB_TOKEN = 'gha-token'
    process.env.GITHUB_SHA = '123abc'
    process.env.GITHUB_ACTOR = 'monalisa'
    process.env.GITHUB_ACTION = '__monalisa/octocat'
    process.env.GITHUB_ACTION_PATH = 'something'

    jest.spyOn(core, 'getInput').mockImplementation(param => {
      switch (param) {
        case 'artifact_name':
          return 'github-pages'
        case 'token':
          return process.env.GITHUB_TOKEN
        default:
          return process.env[`INPUT_${param.toUpperCase()}`] || ''
      }
    })

    jest.spyOn(core, 'setOutput').mockImplementation(param => {
      return param
    })

    jest.spyOn(core, 'setFailed').mockImplementation(param => {
      return param
    })
    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(jest.fn())
    jest.spyOn(core, 'warning').mockImplementation(jest.fn())
    jest.spyOn(core, 'info').mockImplementation(jest.fn())
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())
  })

  describe('#create', () => {
    afterEach(() => {
      // Remove mock for `core.getInput('preview')`
      delete process.env.INPUT_PREVIEW
    })

    it('can successfully create a deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(200, {
          value: [
            { url: 'https://another-artifact.com', name: 'another-artifact' },
            { url: 'https://fake-artifact.com', name: 'github-pages' }
          ]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_url: 'https://fake-artifact.com&%24expand=SignedContent',
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Created deployment for ${process.env.GITHUB_SHA}`))
      )

      artifactExchangeScope.done()
      createDeploymentScope.done()
    })

    it('can successfully create a preview deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(200, {
          value: [
            { url: 'https://another-artifact.com', name: 'another-artifact' },
            { url: 'https://fake-artifact.com', name: 'github-pages' }
          ]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_url: 'https://fake-artifact.com&%24expand=SignedContent',
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt,
          preview: true
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome',
          preview_url: 'https://actions.drafts.github.io/is-awesome'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Return `"true"` for `core.getInput("preview")`
      process.env.INPUT_PREVIEW = 'true'

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`^Created deployment for ${process.env.GITHUB_SHA}`))
      )

      artifactExchangeScope.done()
      createDeploymentScope.done()
    })

    it('reports errors with failed artifact exchange', async () => {
      process.env.GITHUB_SHA = 'invalid-build-version'
      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(400, {})

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 400) with build version ${process.env.GITHUB_SHA}. Responded with: Bad Request`
        )
      )

      artifactExchangeScope.done()
    })

    it('reports errors with failed deployments', async () => {
      process.env.GITHUB_SHA = 'invalid-build-version'
      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(200, { value: [{ url: 'https://invalid-artifact.com', name: 'github-pages' }] })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_url: 'https://invalid-artifact.com&%24expand=SignedContent',
          pages_build_version: process.env.GITHUB_SHA
        })
        .reply(400, { message: 'Bad request' })

      // Create the deployment
      const deployment = new Deployment()
      await expect(deployment.create()).rejects.toEqual(
        new Error(
          `Failed to create deployment (status: 400) with build version ${process.env.GITHUB_SHA}. Responded with: Bad request`
        )
      )

      artifactExchangeScope.done()
      createDeploymentScope.done()
    })
  })

  describe('#check', () => {
    it('sets output to success when deployment is successful', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(200, {
          value: [
            { url: 'https://another-artifact.com', name: 'another-artifact' },
            { url: 'https://fake-artifact.com', name: 'github-pages' }
          ]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_url: 'https://fake-artifact.com&%24expand=SignedContent',
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const deploymentStatusScope = nock('https://api.github.com')
        .get(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`)
        .reply(200, {
          status: 'succeed'
        })

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)
      core.GetInput = jest.fn(input => {
        switch (input) {
          case 'timeout':
            return 10 * 1000
          case 'reporting_interval':
            return 0
        }
      })

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)
      await deployment.check()

      expect(core.setOutput).toBeCalledWith('status', 'succeed')
      expect(core.info).toHaveBeenLastCalledWith('Reported success!')

      artifactExchangeScope.done()
      createDeploymentScope.done()
      deploymentStatusScope.done()
    })
  })

  describe('#cancel', () => {
    it('can successfully cancel a deployment', async () => {
      process.env.GITHUB_SHA = 'valid-build-version'

      const artifactExchangeScope = nock(`http://my-url`)
        .get('/_apis/pipelines/workflows/123/artifacts?api-version=6.0-preview')
        .reply(200, {
          value: [
            { url: 'https://another-artifact.com', name: 'another-artifact' },
            { url: 'https://fake-artifact.com', name: 'github-pages' }
          ]
        })

      const createDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments`, {
          artifact_url: 'https://fake-artifact.com&%24expand=SignedContent',
          pages_build_version: process.env.GITHUB_SHA,
          oidc_token: fakeJwt
        })
        .reply(200, {
          status_url: `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}`,
          page_url: 'https://actions.github.io/is-awesome'
        })

      const cancelDeploymentScope = nock('https://api.github.com')
        .post(`/repos/${process.env.GITHUB_REPOSITORY}/pages/deployments/${process.env.GITHUB_SHA}/cancel`)
        .reply(200, {})

      core.getIDToken = jest.fn().mockResolvedValue(fakeJwt)

      // Create the deployment
      const deployment = new Deployment()
      await deployment.create(fakeJwt)

      // Cancel it
      await deployment.cancel()

      expect(core.info).toHaveBeenLastCalledWith(`Canceled deployment with ID ${process.env.GITHUB_SHA}`)

      artifactExchangeScope.done()
      createDeploymentScope.done()
      cancelDeploymentScope.done()
    })
  })
})
