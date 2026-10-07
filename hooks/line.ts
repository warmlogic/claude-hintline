// Pure formatting, kept apart from the hooks so tests can drive it directly.

import type { Limit, Usage } from '../types'

export type { Limit, Usage }

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 24 * MS_PER_HOUR
// Windows other than the shortest show only from this much used: a weekly
// limit at 10% is noise most of the week.
const SECONDARY_SHOW_PERCENT = 50

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const UNIT_HOURS: Record<string, number> = { hour: 1, day: 24, week: 168 }

/**
 * A model ID as people say it: `claude-opus-5-5[1m]` → `Opus 5.5`,
 * `claude-haiku-4-5-20251001` → `Haiku 4.5`. Strips a provider prefix
 * (`us.anthropic.`), a `[1m]`-style suffix, a `-` or `@` date, and a `-v1:0`
 * revision. An older `claude-3-5-sonnet`-style ID, or any other shape, is
 * shown as given, never guessed at.
 */
export function prettyModel(id: string): string {
  const match = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:[-@]\d{8})?(?:-v\d+(?::\d+)?)?(?:\[[^\]]*\])?$/.exec(id)
  const [, family, major, minor] = match ?? []
  if (!family || !major) return id
  // `-0` is a spelled-out major release: claude-opus-4-0 is Opus 4
  return `${family[0]!.toUpperCase()}${family.slice(1)} ${minor && minor !== '0' ? `${major}.${minor}` : major}`
}

/** Compact token count: `417k`, `1M`, `1.5M`. */
export function tokens(count: number): string {
  if (count >= 1_000_000) return `${Number((count / 1_000_000).toFixed(1))}M`
  return `${Math.round(count / 1000)}k`
}

/** Time until reset, minutes always shown below a day: `3d04h`, `1h44m`, `2h03m`, `41m`. */
export function countdown(ms: number): string {
  if (ms >= MS_PER_DAY) {
    const days = Math.floor(ms / MS_PER_DAY)
    const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR)
    return `${days}d${String(hours).padStart(2, '0')}h`
  }
  const hours = Math.floor(ms / MS_PER_HOUR)
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

/** A window kind's count and unit (`five_hour` → 5, `hour`), or undefined for any other shape. */
function parseWindow(kind: string): { count: number; unit: string } | undefined {
  const [, word, unit] = /^([a-z]+)_(hour|day|week)$/.exec(kind) ?? []
  const count = word === undefined ? undefined : NUMBER_WORDS[word]
  return count !== undefined && unit !== undefined ? { count, unit } : undefined
}

/** A window's label: `five_hour` → `5h`, `seven_day` → `7d`; any other kind as given (`spend_limit`). */
export function windowLabel(kind: string): string {
  const window = parseWindow(kind)
  return window ? `${window.count}${window.unit[0]}` : kind
}

/**
 * The windows worth showing: the shortest known window always, every other
 * window only from SECONDARY_SHOW_PERCENT used. With no known window, the
 * first reported one stands in as the shortest.
 */
export function visibleLimits(limits: readonly Limit[]): Limit[] {
  const ranked = limits
    .map((limit, i) => {
      const window = parseWindow(limit.kind)
      const hours = window ? window.count * (UNIT_HOURS[window.unit] ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
      return { limit, hours, i }
    })
    .sort((a, b) => a.hours - b.hours || a.i - b.i)
  const primary = ranked[0]?.limit
  return ranked
    .filter(({ limit }) => limit === primary || limit.percent >= SECONDARY_SHOW_PERCENT)
    .map(({ limit }) => limit)
}

/** `Opus 5.5 · 417k/1M · 5h: 63% ↺1h44m · 7d: 81% ↺2d06h`, each part dropped when unknown. */
export function usageLine(usage: Usage): string {
  const parts: string[] = []
  if (usage.model) parts.push(prettyModel(usage.model))
  if (usage.usedTokens !== undefined && usage.windowTokens !== undefined) {
    parts.push(`${tokens(usage.usedTokens)}/${tokens(usage.windowTokens)}`)
  }
  for (const limit of visibleLimits(usage.limits ?? [])) {
    const remaining = limit.resetsInMs
    const reset = remaining !== undefined && remaining > 0 ? ` ↺${countdown(remaining)}` : ''
    parts.push(`${windowLabel(limit.kind)}: ${Math.round(limit.percent)}%${reset}`)
  }
  return parts.join(' · ')
}
