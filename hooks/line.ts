// Pure formatting, kept apart from the hooks so tests can drive it directly.

import type { Usage } from '../types'

export type { Usage }

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

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

/** Time until reset, minutes always shown: `1h44m`, `2h03m`, `41m`. */
export function countdown(ms: number): string {
  const hours = Math.floor(ms / MS_PER_HOUR)
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

/** `Opus 5.5 · 417k/1M · 5h: 63% ↺1h44m`, each part dropped when unknown. */
export function usageLine(usage: Usage): string {
  const parts: string[] = []
  if (usage.model) parts.push(prettyModel(usage.model))
  if (usage.usedTokens !== undefined && usage.windowTokens !== undefined) {
    parts.push(`${tokens(usage.usedTokens)}/${tokens(usage.windowTokens)}`)
  }
  if (usage.fiveHourPercent !== undefined) {
    const remaining = usage.fiveHourResetsInMs
    const reset = remaining !== undefined && remaining > 0 ? ` ↺${countdown(remaining)}` : ''
    parts.push(`5h: ${Math.round(usage.fiveHourPercent)}%${reset}`)
  }
  return parts.join(' · ')
}
