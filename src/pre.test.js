const core = require('@actions/core')
const process = require('process')
const axios = require('axios')

const {expect, jest} = require('@jest/globals')

const {emitTelemetry} = require('./pre')

describe('emitTelemetry', () => {
  beforeAll(() => {
    process.env.ACTIONS_RUNTIME_URL = 'my-url'
    process.env.GITHUB_RUN_ID = '123'
    process.env.ACTIONS_RUNTIME_TOKEN = 'a-token'
    process.env.GITHUB_REPOSITORY = 'paper-spa/is-awesome'
    process.env.GITHUB_TOKEN = 'gha-token'
    process.env.GITHUB_SHA = '123abc'
    process.env.GITHUB_ACTOR = 'monalisa'
    process.env.GITHUB_ACTION = '__monalisa/octocat'
    process.env.GITHUB_ACTION_PATH = 'something'

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

  it('will send telemetry to github api', done => {
    process.env.GITHUB_SHA = 'valid-build-version'

    axios.post = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        status: 'succeed'
      }
    })

    emitTelemetry()

    expect(axios.post).toBeCalledWith(
      'https://api.github.com/repos/paper-spa/is-awesome/pages/telemetry',
      {
        github_run_id: process.env.GITHUB_RUN_ID
      },
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'Bearer ',
          'Content-type': 'application/json'
        }
      }
    )

    expect(core.setFailed).not.toHaveBeenCalled()
    done()
  })
})
