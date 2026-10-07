/** What one draw of the hint needs; each part left out when unknown. */
export type Usage = {
  model?: string
  usedTokens?: number
  windowTokens?: number
  fiveHourPercent?: number
  fiveHourResetsInMs?: number
}

declare module 'claude-code' {
  interface PluginState {
    'hintline': { usage: Usage | null }
  }
}
