import { config as loadEnv } from 'dotenv';
loadEnv();
const PAGE_ID = 9159;
const base = process.env.WP_BASE_URL.replace(/\/$/, '');
const auth = 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');

const HEX = '0123456789abcdef';
const id = () => Array.from({ length: 7 }, () => HEX[Math.floor(Math.random() * 16)]).join('');
const slider = (size, unit = 'px') => ({ unit, size, sizes: [] });
const gap = (size, unit = 'px') => ({ unit, size, column: String(size), row: String(size) });
const dims = (v, unit = 'px') =>
  typeof v === 'number'
    ? { unit, top: String(v), right: String(v), bottom: String(v), left: String(v), isLinked: true }
    : { unit, top: String(v.top ?? ''), right: String(v.right ?? ''), bottom: String(v.bottom ?? ''), left: String(v.left ?? ''), isLinked: false };
const widget = (widgetType, settings) => ({ id: id(), elType: 'widget', widgetType, settings, elements: [] });
const cont = (settings, elements = [], isInner = true) => ({ id: id(), elType: 'container', settings, elements, isInner });

// decorative green circle, clipped to corner by card overflow:hidden
const circle = cont({
  content_width: 'full',
  width: { unit: 'px', size: 230, sizes: [] },
  height: { unit: 'px', size: 230, sizes: [] },
  background_background: 'classic',
  background_color: '#C6F24E',
  border_radius: dims(50, '%'),
  _position: 'absolute',
  _offset_orientation_h: 'end', _offset_x_end: slider(-40),
  _offset_orientation_v: 'end', _offset_y_end: slider(-70),
  z_index: 0
});

const bell = widget('icon', {
  selected_icon: { value: 'fas fa-bell', library: 'fa-solid' },
  primary_color: '#FFFFFF',
  size: slider(44),
  _margin: dims({ top: 6, right: 0, bottom: 0, left: 0 })
});

const textCol = cont(
  { content_width: 'full', flex_direction: 'column', flex_gap: gap(10), width: 'auto' },
  [
    widget('heading', {
      title: 'From the Founding Team',
      header_size: 'h2',
      title_color: '#FFFFFF',
      typography_typography: 'custom',
      typography_font_size: slider(40),
      typography_font_weight: '800'
    }),
    widget('text-editor', {
      editor: '<p>We built Xoopah so small businesses can run better ads — simply.<br>If you want a hand, we’re here.</p>',
      text_color: '#C7CBD1',
      typography_typography: 'custom',
      typography_font_size: slider(17),
      typography_line_height: slider(1.5, 'em')
    })
  ]
);

const leftRow = cont(
  { content_width: 'full', flex_direction: 'row', flex_align_items: 'center', flex_gap: gap(22), width: 'auto', z_index: 2 },
  [bell, textCol]
);

const viewBtn = widget('button', {
  text: 'View',
  selected_icon: { value: 'fas fa-arrow-right', library: 'fa-solid' },
  icon_align: 'right',
  icon_indent: slider(10),
  background_color: 'rgba(0,0,0,0)',
  button_text_color: '#FFFFFF',
  hover_color: '#0A0A0A',
  button_background_hover_color: '#FFFFFF',
  border_border: 'solid',
  border_width: dims(1),
  border_color: '#FFFFFF',
  border_radius: dims(10),
  text_padding: dims({ top: 12, right: 26, bottom: 12, left: 26 }),
  typography_typography: 'custom',
  typography_font_size: slider(16),
  typography_font_weight: '600',
  _z_index: 2
});
const btnWrap = cont({ content_width: 'full', width: 'auto', z_index: 2, flex_align_items: 'center', flex_justify_content: 'center' }, [viewBtn]);

const card = cont({
  content_width: 'full',
  flex_direction: 'row',
  flex_align_items: 'center',
  flex_justify_content: 'space-between',
  flex_wrap: 'wrap',
  flex_gap: gap(24),
  padding: dims({ top: 44, right: 48, bottom: 44, left: 48 }),
  background_background: 'classic',
  background_color: '#0A0A0A',
  border_radius: dims(24),
  overflow: 'hidden'
}, [circle, leftRow, btnWrap]);

const section = cont({
  content_width: 'boxed',
  flex_direction: 'column',
  padding: dims({ top: 30, right: 20, bottom: 30, left: 20 }),
  background_background: 'classic',
  background_color: '#FFFFFF'
}, [card], false);

const h = { headers: { Authorization: auth, 'Content-Type': 'application/json' } };
const cur = await fetch(`${base}/wp-json/xmcp/v1/page/${PAGE_ID}`, h).then((r) => r.json());
const elements = Array.isArray(cur.elements) ? cur.elements : [];
elements.push(section);
const out = await fetch(`${base}/wp-json/xmcp/v1/page`, {
  method: 'POST', headers: h.headers,
  body: JSON.stringify({ title: cur.title || 'MCP Test Page', status: 'publish', page_id: PAGE_ID, elements })
}).then((r) => r.json());
console.log('Top-level elements now:', elements.length, '\n', JSON.stringify(out, null, 2));
