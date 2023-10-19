const stateKeys = require('../../internal/state-keys')

describe('stateKeys', () => {
  it('contains expected keys', () => {
    expect(Object.keys(stateKeys).sort()).toEqual(['id', 'isPending'])
  })

  it('#id contains expected value', () => {
    expect(stateKeys.id).toBe('PAGES_DEPLOYMENT_ID')
  })

  it('#isPending contains expected value', () => {
    expect(stateKeys.isPending).toBe('PAGES_DEPLOYMENT_PENDING')
  })
})
