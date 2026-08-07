/**
 * Build-time feature switches.
 *
 * Features default to enabled so regular development and GitHub releases keep
 * their existing behavior. Distribution-specific builds can opt out via Vite
 * environment variables without carrying a source-code fork.
 */
export const buildFeatures = {
  coffee: import.meta.env.VITE_ENABLE_COFFEE !== "false",
} as const;
