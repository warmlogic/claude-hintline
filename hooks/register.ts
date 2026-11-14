import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Usage } from '../types'
import { usageLine } from './line'

// Refresh often enough for a countdown's minutes to stay right.
const COUNTDOWN_REFRESH_MS = 30_000

const usage = atom({ plugin: 'hintline', key: 'usage' } as const, null)

async function measure($: Engine, lastResponseAt: number | undefined): Promise<Usage> {
  const [model, figures, now] = await Promise.all([$.session.model(), $.session.usage(), $.clock.now()])
  return {
    model,
    idleMs: lastResponseAt === undefined ? undefined : now - lastResponseAt,
    usedTokens: figures.context.tokens,
    windowTokens: figures.context.window,
    limits: figures.rateLimits.map(limit => ({
      kind: limit.kind,
      percent: limit.percentUsed,
      resetsInMs: limit.resetsAt ? Date.parse(limit.resetsAt) - now : undefined,
    })),
  }
}

/** Re-measures and stores the figures, which redraws the hint; a failure is logged, never raised. */
async function refresh($: Engine, lastResponseAt: number | undefined): Promise<void> {
  try {
    const next = await measure($, lastResponseAt)
    const current = await read($, usage)
    // A write redraws the hint, so skip it when the visible text would not change
    if (current !== null && usageLine(current) === usageLine(next)) return
    await update($, usage, () => next)
  } catch (error) {
    $.ui.log(`hintline: could not refresh (${error instanceof Error ? error.message : String(error)})`)
  }
}

export const register: Register = on => {
  // When the main loop last had a model response, which renews the prompt
  // cache. Kept out of the atom, whose write is skipped when the text is unchanged.
  let lastResponseAt: number | undefined

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($, lastResponseAt)
    $.clock.every(COUNTDOWN_REFRESH_MS, () => void refresh($, lastResponseAt))
    return result
  })

  // Each main-loop response renews the cache; a subagent's (`agentId`) or a failed request doesn't.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId === undefined && result.usage !== null) lastResponseAt = await $.clock.now()
    return result
  })

  // A turn moves the context and rate-limit figures.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($, lastResponseAt)
    return result
  })

  // Model, context, cache and rate-limit usage, dim, after the hint line under the prompt.
  // `tail` is one string every plugin shares; this puts usage first, so another
  // plugin that appends its own piece lands after it whichever hook runs first.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const current = await read($, usage)
    const text = current === null ? '' : usageLine(current, e.props.isWorking)
    if (!text) return next(e)
    const tail = [text, e.props.tail].filter(Boolean).join(' · ')
    return next({ ...e, props: { ...e.props, tail } })
  })
}
