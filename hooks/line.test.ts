import { describe, expect, test } from 'claude-code/testing'

import { countdown, prettyModel, tokens, usageLine, visibleLimits, windowLabel } from './line'

describe('prettyModel', () => {
  test('names a model ID the way people say it', async () => {
    expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
    expect(prettyModel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
    expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
    expect(prettyModel('us.anthropic.claude-opus-5-5-v1:0')).toBe('Opus 5.5')
    expect(prettyModel('claude-opus-4-1@20250805')).toBe('Opus 4.1')
    expect(prettyModel('claude-opus-4-0')).toBe('Opus 4')
  })
  test('keeps an ID in no known shape', async () => {
    expect(prettyModel('gpt-x')).toBe('gpt-x')
    expect(prettyModel('Opus 5.5')).toBe('Opus 5.5')
    expect(prettyModel('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022')
    expect(prettyModel('claude-mythos-preview')).toBe('claude-mythos-preview')
  })
})

describe('tokens', () => {
  test('uses k under a million and M from a million', async () => {
    expect(tokens(417_000)).toBe('417k')
    expect(tokens(1_000_000)).toBe('1M')
    expect(tokens(1_500_000)).toBe('1.5M')
    expect(tokens(200_000)).toBe('200k')
    expect(tokens(999_600)).toBe('1M')
  })
})

describe('countdown', () => {
  test('always shows minutes', async () => {
    expect(countdown((1 * 60 + 44) * 60_000)).toBe('1h44m')
    expect(countdown((2 * 60 + 3) * 60_000)).toBe('2h03m')
    expect(countdown(41 * 60_000)).toBe('41m')
  })
  test('switches to days and hours from a day out', async () => {
    expect(countdown((3 * 24 + 4) * 3_600_000 + 59 * 60_000)).toBe('3d04h')
  })
})

describe('windowLabel', () => {
  test('derives a label from the window kind', async () => {
    expect(windowLabel('five_hour')).toBe('5h')
    expect(windowLabel('ten_hour')).toBe('10h')
    expect(windowLabel('seven_day')).toBe('7d')
    expect(windowLabel('two_week')).toBe('2w')
  })
  test('keeps any other kind as given', async () => {
    expect(windowLabel('spend_limit')).toBe('spend_limit')
    expect(windowLabel('ninetynine_hour')).toBe('ninetynine_hour')
  })
})

describe('visibleLimits', () => {
  const fiveHour = { kind: 'five_hour', percent: 10 }
  test('always shows the shortest window, others only from 50%', async () => {
    expect(visibleLimits([{ kind: 'seven_day', percent: 49 }, fiveHour])).toEqual([fiveHour])
    expect(visibleLimits([{ kind: 'seven_day', percent: 50 }, fiveHour])).toEqual([
      fiveHour,
      { kind: 'seven_day', percent: 50 },
    ])
  })
  test('treats an unknown kind as a secondary window', async () => {
    expect(visibleLimits([fiveHour, { kind: 'spend_limit', percent: 20 }])).toEqual([fiveHour])
    expect(visibleLimits([fiveHour, { kind: 'spend_limit', percent: 90 }])).toEqual([
      fiveHour,
      { kind: 'spend_limit', percent: 90 },
    ])
  })
  test('with no five-hour window, the weekly one always shows', async () => {
    const weekly = { kind: 'seven_day', percent: 12 }
    expect(visibleLimits([weekly])).toEqual([weekly])
    expect(visibleLimits([{ kind: 'spend_limit', percent: 20 }, weekly])).toEqual([weekly])
  })
  test('with no known window, the first reported one stands in', async () => {
    expect(visibleLimits([{ kind: 'spend_limit', percent: 5 }])).toEqual([{ kind: 'spend_limit', percent: 5 }])
  })
})

describe('usageLine', () => {
  test('draws every part', async () => {
    expect(
      usageLine({
        model: 'claude-opus-5-5[1m]',
        usedTokens: 317_000,
        windowTokens: 1_000_000,
        idleMs: 9 * 60_000,
        limits: [
          { kind: 'five_hour', percent: 63.2, resetsInMs: (1 * 60 + 44) * 60_000 },
          { kind: 'seven_day', percent: 81, resetsInMs: (2 * 24 + 6) * 3_600_000 },
        ],
      }),
    ).toBe('Opus 5.5 · 317k/1M · cache 51m · 5h: 63% ↺1h44m · 7d: 81% ↺2d06h')
  })
  test('drops the countdown once the window has reset', async () => {
    expect(usageLine({ limits: [{ kind: 'five_hour', percent: 30, resetsInMs: -5 }] })).toBe('5h: 30%')
  })
  test('drops what is unknown', async () => {
    expect(usageLine({ model: 'Sonnet' })).toBe('Sonnet')
    expect(usageLine({})).toBe('')
  })
})

describe('cache', () => {
  const plan = [{ kind: 'five_hour', percent: 10 }]
  test('counts down an hour on a plan, five minutes otherwise', async () => {
    expect(usageLine({ idleMs: 9 * 60_000, limits: plan })).toBe('cache 51m · 5h: 10%')
    expect(usageLine({ idleMs: 9 * 60_000, limits: [{ kind: 'seven_day', percent: 10 }] })).toBe('cache 51m · 7d: 10%')
    expect(usageLine({ idleMs: 2 * 60_000 })).toBe('cache 3m')
    expect(usageLine({ idleMs: 2 * 60_000, limits: [{ kind: 'spend_limit', percent: 10 }] })).toBe(
      'cache 3m · spend_limit: 10%',
    )
  })
  test('is cold from its last minute', async () => {
    expect(usageLine({ idleMs: 3_600_000 - 60_000, limits: plan })).toBe('cache 1m · 5h: 10%')
    expect(usageLine({ idleMs: 3_600_000 - 59_999, limits: plan })).toBe('cache cold · 5h: 10%')
    expect(usageLine({ idleMs: 300_000 })).toBe('cache cold')
  })
  test('is hidden before the first response and while a turn runs', async () => {
    expect(usageLine({ limits: plan })).toBe('5h: 10%')
    expect(usageLine({ idleMs: 60_000, limits: plan }, true)).toBe('5h: 10%')
  })
})

describe('hand-off alert', () => {
  const window = 1_000_000
  test('leads the line from 400k tokens of context', async () => {
    expect(usageLine({ usedTokens: 399_999, windowTokens: window })).toBe('400k/1M')
    expect(usageLine({ usedTokens: 400_000, windowTokens: window })).toBe('⚠ hand off · 400k/1M')
  })
  test('ignores rate limits, which a fresh session would not reset', async () => {
    expect(usageLine({ limits: [{ kind: 'five_hour', percent: 95 }] })).toBe('5h: 95%')
  })
  test('needs a reading to fire', async () => {
    expect(usageLine({ windowTokens: window })).toBe('')
  })
})
