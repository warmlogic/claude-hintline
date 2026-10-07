import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Usage } from '../types'
import { usageLine } from './line'

// Refresh often enough for the 5-hour countdown's minutes to stay right.
const COUNTDOWN_REFRESH_MS = 30_000

const usage = atom({ plugin: 'hintline', key: 'usage' } as const, null)

async function measure($: Engine): Promise<Usage> {
  const [model, figures, now] = await Promise.all([$.session.model(), $.session.usage(), $.clock.now()])
  const fiveHour = figures.rateLimits.find(limit => limit.kind === 'five_hour')
  const resetsAt = fiveHour?.resetsAt ? Date.parse(fiveHour.resetsAt) : undefined
  return {
    model,
    usedTokens: figures.context.tokens,
    windowTokens: figures.context.window,
    fiveHourPercent: fiveHour?.percentUsed,
    fiveHourResetsInMs: resetsAt !== undefined ? resetsAt - now : undefined,
  }
}

/** Re-measures and stores the figures, which redraws the hint; a failure is logged, never raised. */
async function refresh($: Engine): Promise<void> {
  try {
    const next = await measure($)
    await update($, usage, () => next)
  } catch (error) {
    $.ui.log(`hintline: could not refresh (${error instanceof Error ? error.message : String(error)})`)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    $.clock.every(COUNTDOWN_REFRESH_MS, () => void refresh($))
    return result
  })

  // A turn moves the context and rate-limit figures.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // Model, context and 5-hour usage, dim, after the hint line under the prompt.
  // `tail` is one string every plugin shares, so this appends to it.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const current = await read($, usage)
    const text = current === null ? '' : usageLine(current)
    if (!text) return next(e)
    const tail = [e.props.tail, text].filter(Boolean).join(' · ')
    return next({ ...e, props: { ...e.props, tail } })
  })
}
