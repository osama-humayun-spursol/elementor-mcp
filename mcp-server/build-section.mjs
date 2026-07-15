import { config as loadEnv } from 'dotenv';
loadEnv();

const PAGE_ID = 9159;
const PLACEHOLDER = 'https://placehold.co/600x720/cfd5e0/cfd5e0.png';

const base = process.env.WP_BASE_URL.replace(/\/$/, '');
const auth = 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');

// ---- Elementor value helpers (mirror mcp-server/src/elementor/values.ts) ----
const HEX = '0123456789abcdef';
const id = () => Array.from({ length: 7 }, () => HEX[Math.floor(Math.random() * 16)]).join('');
const slider = (size, unit = 'px') => ({ unit, size, sizes: [] });
const gap = (size, unit = 'px') => ({ unit, size, column: String(size), row: String(size) });
const dims = (v, unit = 'px') =>
  typeof v === 'number'
    ? { unit, top: String(v), right: String(v), bottom: String(v), left: String(v), isLinked: true }
    : { unit, top: String(v.top ?? ''), right: String(v.right ?? ''), bottom: String(v.bottom ?? ''), left: String(v.left ?? ''), isLinked: false };

const widget = (widgetType, settings) => ({ id: id(), elType: 'widget', widgetType, settings, elements: [] });
const container = (settings, elements = [], isInner = true) => ({ id: id(), elType: 'container', settings, elements, isInner });

// ---- Card factory (background image + dark gradient overlay + white label) ----
function card(label, imageUrl) {
  return container(
    {
      content_width: 'full',
      flex_direction: 'column',
      flex_justify_content: 'flex-end',
      flex_align_items: 'flex-start',
      min_height: slider(360),
      width: { unit: '%', size: 31, sizes: [] },
      flex_grow: '0',
      padding: dims(24),
      border_radius: dims(18),
      border_border: 'solid',
      border_width: dims(1),
      border_color: '#E5E9F2',
      overflow: 'hidden',
      // background image
      background_background: 'classic',
      background_image: { url: imageUrl, id: '' },
      background_size: 'cover',
      background_position: 'center center',
      // gradient overlay: transparent top -> dark bottom (keeps white label readable)
      background_overlay_background: 'gradient',
      background_overlay_color: 'rgba(0,0,0,0)',
      background_overlay_color_stop: { unit: '%', size: 40, sizes: [] },
      background_overlay_color_b: 'rgba(0,0,0,0.6)',
      background_overlay_color_b_stop: { unit: '%', size: 100, sizes: [] },
      background_overlay_gradient_type: 'linear',
      background_overlay_gradient_angle: { unit: 'deg', size: 180, sizes: [] }
    },
    [
      widget('heading', {
        title: label,
        header_size: 'h3',
        title_color: '#FFFFFF',
        typography_typography: 'custom',
        typography_font_size: slider(30),
        typography_font_weight: '700',
        text_shadow_text_shadow_type: 'yes',
        text_shadow_text_shadow: { horizontal: 0, vertical: 1, blur: 8, color: 'rgba(0,0,0,0.6)' }
      })
    ]
  );
}

// ---- Badge pill (button widget = auto-width, easy rounded pill) ----
const badge = widget('button', {
  text: 'Why Xoopah?',
  align: 'center',
  background_color: '#DCE4FF',
  button_text_color: '#3B5BFF',
  border_radius: dims(30),
  text_padding: dims({ top: 10, right: 26, bottom: 10, left: 26 }),
  button_hover_border_color: '',
  hover_color: '#3B5BFF',
  button_background_hover_color: '#DCE4FF',
  typography_typography: 'custom',
  typography_font_size: slider(15),
  typography_font_weight: '600'
});

const heading = widget('heading', {
  title: 'Built for Small Businesses',
  header_size: 'h2',
  align: 'center',
  title_color: '#14181F',
  typography_typography: 'custom',
  typography_font_size: slider(52),
  typography_font_weight: '800',
  typography_line_height: slider(1.1, 'em')
});

const subtext = widget('text-editor', {
  editor:
    '<p>We aim to provide solutions to local owners, service providers, solopreneurs, and growing brands who need simple, effective ads — without the agency price tag.</p>',
  align: 'center',
  text_color: '#2A2F3A',
  _element_width: 'initial',
  _element_custom_width: slider(720),
  typography_typography: 'custom',
  typography_font_size: slider(18),
  typography_line_height: slider(1.5, 'em')
});

const cardsRow = container(
  {
    content_width: 'full',
    flex_direction: 'row',
    flex_justify_content: 'center',
    flex_align_items: 'stretch',
    flex_wrap: 'wrap',
    flex_gap: gap(28),
    margin: dims({ top: 20, bottom: 0, left: 0, right: 0 })
  },
  [
    card('Automotive', PLACEHOLDER),
    card('Healthcare', PLACEHOLDER),
    card('Events', PLACEHOLDER)
  ]
);

// ---- Outer section ----
const section = container(
  {
    content_width: 'boxed',
    flex_direction: 'column',
    flex_align_items: 'center',
    flex_gap: gap(22),
    padding: dims({ top: 80, right: 20, bottom: 80, left: 20 }),
    background_background: 'classic',
    background_color: '#FFFFFF'
  },
  [badge, heading, subtext, cardsRow],
  false
);

// ---- Read existing, append, write back ----
const h = { headers: { Authorization: auth, 'Content-Type': 'application/json' } };

const cur = await fetch(`${base}/wp-json/xmcp/v1/page/${PAGE_ID}`, h).then((r) => r.json());
const elements = Array.isArray(cur.elements) ? cur.elements : [];
elements.push(section);

const res = await fetch(`${base}/wp-json/xmcp/v1/page`, {
  method: 'POST',
  headers: h.headers,
  body: JSON.stringify({ title: cur.title || 'MCP Test Page', status: 'publish', page_id: PAGE_ID, elements })
});
const out = await res.json();
console.log('Top-level elements now:', elements.length);
console.log(JSON.stringify(out, null, 2));
