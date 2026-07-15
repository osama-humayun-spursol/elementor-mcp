export const config = {
  wpBaseUrl: process.env.WP_BASE_URL ?? '',
  wpUser: process.env.WP_USER ?? '',
  wpAppPassword: process.env.WP_APP_PASSWORD ?? ''
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
