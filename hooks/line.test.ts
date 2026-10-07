import { describe, expect, test } from 'claude-code/testing'

import { countdown, prettyModel, tokens, usageLine } from './line'

describe('prettyModel', () => {
  test('names a model ID the way people say it', async () => {
    expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
    expect(prettyModel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
    expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
    expect(prettyModel('us.anthropic.claude-opus-5-5-v1:0')).toBe('Opus 5.5')
  })
  test('keeps an ID in no known shape', async () => {
    expect(prettyModel('gpt-x')).toBe('gpt-x')
    expect(prettyModel('Opus 5.5')).toBe('Opus 5.5')
  })
})

describe('tokens', () => {
  test('uses k under a million and M from a million', async () => {
    expect(tokens(417_000)).toBe('417k')
    expect(tokens(1_000_000)).toBe('1M')
    expect(tokens(1_500_000)).toBe('1.5M')
    expect(tokens(200_000)).toBe('200k')
  })
})

describe('countdown', () => {
  test('always shows minutes', async () => {
    expect(countdown((1 * 60 + 44) * 60_000)).toBe('1h44m')
    expect(countdown((2 * 60 + 3) * 60_000)).toBe('2h03m')
    expect(countdown(41 * 60_000)).toBe('41m')
  })
})

describe('usageLine', () => {
  test('draws every part', async () => {
    expect(
      usageLine({
        model: 'claude-opus-5-5[1m]',
        usedTokens: 417_000,
        windowTokens: 1_000_000,
        fiveHourPercent: 63.2,
        fiveHourResetsInMs: (1 * 60 + 44) * 60_000,
      }),
    ).toBe('Opus 5.5 · 417k/1M · 5h: 63% ↺1h44m')
  })
  test('drops the countdown once the window has reset', async () => {
    expect(usageLine({ fiveHourPercent: 100, fiveHourResetsInMs: -5 })).toBe('5h: 100%')
  })
  test('drops what is unknown', async () => {
    expect(usageLine({ model: 'Sonnet' })).toBe('Sonnet')
    expect(usageLine({})).toBe('')
  })
})
