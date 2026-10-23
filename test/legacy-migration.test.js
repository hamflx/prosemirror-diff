import {describe, expect, it} from 'vitest'
import {diffEditor} from '../src/diff.js'
import {compareLegacyOrExplain} from '../example/src/legacy-migration.js'
import {schema, scenarios} from '../example/src/legacy-migration-scenarios.js'

describe('example legacy migration adapter', () => {
  it('does not present an invalid source document as an output limitation', () => {
    const invalid = schema.node('doc', null, [schema.nodes.code_block.create(null,
      schema.text('invalid', [schema.marks.strong.create()]))])
    const json = invalid.toJSON()
    const before = structuredClone(json)
    expect(() => compareLegacyOrExplain(() => diffEditor(schema, json, json)))
      .toThrow(/^Invalid input node:/)
    expect(json).toEqual(before)
  })
  it.each(scenarios)('preserves both valid $id originals and reports the supported outcome', scenario => {
    scenario.oldDoc.check(); scenario.newDoc.check()
    const original = structuredClone([scenario.oldDoc.toJSON(), scenario.newDoc.toJSON()])
    const result = compareLegacyOrExplain(() => diffEditor(schema, original[0], original[1]))
    if (scenario.id === 'ordinary') {
      expect(result.status).toBe('available')
      result.node.check()
      expect(result.node.textContent).toBe('cart')
    } else {
      expect(result.status).toBe('unrepresentable')
      expect(result).not.toHaveProperty('node')
      expect(result.message).toContain('Both original versions remain available')
    }
    expect([scenario.oldDoc.toJSON(), scenario.newDoc.toJSON()]).toEqual(original)
  })
  it.each([
    new Error('unexpected'), new TypeError('programming error'), new RangeError('unrelated range'),
    new RangeError('Invalid input node: bad content', {cause: new RangeError('invalid')}),
    new RangeError('Diff output cannot be represented in the original schema: custom error without validation cause')
  ])('rethrows errors outside the specific output validation boundary: %s', error => {
    let caught
    try { compareLegacyOrExplain(() => { throw error }) } catch (actual) { caught = actual }
    expect(caught).toBe(error)
  })
})
