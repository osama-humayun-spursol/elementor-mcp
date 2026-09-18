import { config, assertConfig } from './config.js';

function basicToken(): string {
  return Buffer.from(`${config.wpUser}:${config.wpAppPassword}`).toString('base64');
}

function authHeader(): string {
  return `Basic ${basicToken()}`;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  assertConfig();
  const base = config.wpBaseUrl.replace(/\/$/, '');
  const url = `${base}/wp-json/xmcp/v1${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      // Mirrors of Authorization: some hosts strip the real one at the proxy before PHP
      // sees it — including, on some setups, any header whose name says "authorization".
      // The bridge plugin falls back to whichever of these survives.
      'X-XMCP-Authorization': authHeader(),
      'X-XMCP-Key': basicToken(),
      ...(init.headers ?? {})
    }
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`WordPress responded ${res.status}: ${detail}`);
  }

  return body as T;
}

export interface ElementorElement {
  id: string;
  elType: string;
  widgetType?: string;
  settings: Record<string, unknown>;
  elements: ElementorElement[];
  isInner?: boolean;
}

export interface CreatePagePayload {
  title: string;
  status?: 'publish' | 'draft';
  page_id?: number;
  template?: string;
  elements: ElementorElement[];
}

export interface CreatePageResult {
  success: boolean;
  page_id: number;
  edit_url: string;
  view_url: string;
}

export interface GetPageResult {
  page_id: number;
  title: string;
  elements: ElementorElement[];
}

export const wp = {
  createPage: (payload: CreatePagePayload) =>
    request<CreatePageResult>('/page', { method: 'POST', body: JSON.stringify(payload) }),

  getPage: (id: number) => request<GetPageResult>(`/page/${id}`, { method: 'GET' }),

  updateElement: (payload: { page_id: number; element_id: string; settings: Record<string, unknown> }) =>
    request<{ success: boolean; page_id: number; element_id: string }>('/element', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
};
