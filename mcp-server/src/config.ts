/**
 * Read process.env lazily, never at module-init time.
 *
 * ESM evaluates every static import before the importing module's own top-level
 * code, so index.ts's `loadEnv()` call runs *after* this module is initialised.
 * Capturing process.env here at init would therefore always capture empty values.
 */
export const config = {
  get wpBaseUrl(): string {
    return process.env.WP_BASE_URL ?? '';
  },
  get wpUser(): string {
    return process.env.WP_USER ?? '';
  },
  get wpAppPassword(): string {
    return process.env.WP_APP_PASSWORD ?? '';
  }
};

export function assertConfig(): void {
  const missing: string[] = [];
  if (!config.wpBaseUrl) missing.push('WP_BASE_URL');
  if (!config.wpUser) missing.push('WP_USER');
  if (!config.wpAppPassword) missing.push('WP_APP_PASSWORD');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}. Set them in mcp-server/.env`);
  }
}
