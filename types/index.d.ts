/** One rate-limit window as reported, e.g. kind `five_hour` or `seven_day`. */
export type Limit = {
  kind: string
  percent: number
  resetsInMs?: number
}

/** What one draw of the hint needs; each part left out when unknown. */
export type Usage = {
  model?: string
  usedTokens?: number
  windowTokens?: number
  limits?: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    hintline: { usage: Usage | null }
  }
}
