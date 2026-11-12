jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn().mockResolvedValue() }))

const core = require('@actions/core')
const { DefaultArtifactClient } = require('@actions/artifact')
const { setTimeout: sleep } = require('node:timers/promises')
const { getArtifactMetadata } = require('../../internal/api-client')

describe('getArtifactMetadata', () => {
  const artifact = { id: 123, name: 'custom-pages-artifact', size: 1024 }
  let listArtifacts

  beforeEach(() => {
    jest.clearAllMocks()
    listArtifacts = jest.spyOn(DefaultArtifactClient.prototype, 'listArtifacts')
    jest.spyOn(core, 'info').mockImplementation(() => {})
    jest.spyOn(core, 'debug').mockImplementation(() => {})
    jest.spyOn(core, 'error').mockImplementation(() => {})
  })

  afterEach(() => jest.restoreAllMocks())

  it('returns an available artifact without waiting', async () => {
    listArtifacts.mockResolvedValue({ artifacts: [artifact] })

    await expect(getArtifactMetadata({ artifactName: artifact.name })).resolves.toEqual(artifact)

    expect(listArtifacts).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries when only unrelated artifacts are visible before the Pages artifact', async () => {
    const buildArtifact = { id: 456, name: 'build', size: 2048 }
    listArtifacts
      .mockResolvedValueOnce({ artifacts: [] })
      .mockResolvedValueOnce({ artifacts: [buildArtifact] })
      .mockResolvedValueOnce({ artifacts: [buildArtifact, artifact] })

    await expect(getArtifactMetadata({ artifactName: artifact.name })).resolves.toEqual(artifact)

    expect(listArtifacts).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [2000]])
    expect(core.error).not.toHaveBeenCalled()
  })

  it('fails after bounded retries when the artifact never appears', async () => {
    listArtifacts.mockResolvedValue({ artifacts: [] })

    await expect(getArtifactMetadata({ artifactName: artifact.name })).rejects.toThrow(
      `No artifacts named "${artifact.name}" were found for this workflow run.`
    )

    expect(listArtifacts).toHaveBeenCalledTimes(5)
    expect(sleep.mock.calls).toEqual([[1000], [2000], [4000], [8000]])
  })

  it('rejects duplicate matching artifacts without retrying', async () => {
    listArtifacts.mockResolvedValue({ artifacts: [artifact, { ...artifact, id: 789 }] })

    await expect(getArtifactMetadata({ artifactName: artifact.name })).rejects.toThrow(
      `Multiple artifacts named "${artifact.name}" were unexpectedly found for this workflow run.`
    )

    expect(listArtifacts).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('preserves artifact service failures without adding retries', async () => {
    listArtifacts.mockRejectedValue(new Error('Failed request: (403) Forbidden'))

    await expect(getArtifactMetadata({ artifactName: artifact.name })).rejects.toMatchObject({ status: '403' })

    expect(listArtifacts).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})
