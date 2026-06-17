export function formatGBP(value: number, opts: { compact?: boolean } = {}) {
  if (opts.compact) {
    if (Math.abs(value) >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `£${Math.round(value / 1000)}k`;
    return `£${Math.round(value)}`;
  }
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}
