---
name: figma-to-elementor-page
description: Build or update a WordPress Elementor page from a Figma design, using the Elementor MCP bridge (mcp__elementor__* tools + the xmcp/v1 REST bridge). Use this whenever the user shares a figma.com link and wants a page or section built in Elementor/WordPress, asks to "match the Figma", add or fix a section on an Elementor page, clone an existing page into a new variant, fix responsive/tablet/mobile issues, add sliders/carousels/tabs, or swap images/logos/text on an Elementor page — even if they only say "page bana do", "section complete karo", or "isko Figma jaisa karo".
---

# Figma → Elementor page

You are turning Figma frames into Elementor (Pro, Container/flexbox) pages on a WordPress site through a small bridge plugin. The fastest reliable loop is:

**read Figma → read the current page → build/patch → verify on the live page → tell the user to refresh the editor + purge cache.**

Everything below exists because it went wrong at least once. Read "Gotchas" before writing any settings.

## Prerequisites (check once; stop and tell the user what's missing)

1. **Bridge plugin** active on the WordPress site (`wp-plugin/elementor-mcp-bridge.zip` → Plugins → Upload → Activate). Quick test: `GET <site>/wp-json/xmcp/v1/page/<any page id>` with auth returns JSON, not a 404.
2. **MCP server** built and registered (`mcp-server`: `npm install && npm run build`; `.env` copied from `.env.example` and filled in). `WP_USER` must be the WordPress **login name** and `WP_APP_PASSWORD` an Application Password (Users → Profile → Application Passwords), not the normal password. After editing `.env`, restart Claude Code — the running server keeps the old values.
3. **Elementor Container experiment** active (Elementor → Settings → Features → Flexbox Container, or option `elementor_experiment-container = active`). Without it pages built from containers save **empty**.
4. **Elementor Pro** if you need Pro widgets (Form, Nested Carousel, custom CSS).
5. **Figma MCP** connected, and a browser tool for verification.

## 0. Setup

- The MCP server's `.env` (`mcp-server/.env` in this repo) holds `WP_BASE_URL`, `WP_USER`, `WP_APP_PASSWORD`. Never print or commit these values.
- MCP tools: `mcp__elementor__get_page(pageId)`, `mcp__elementor__update_element(pageId, elementId, settings)` (merges settings into ONE element), `mcp__elementor__create_page(...)`.
- `update_element` only changes settings. To add/remove/reorder elements, save the whole tree: `POST /wp-json/xmcp/v1/page` with `{page_id, title, status, elements}` (omit `page_id` to create). `GET /wp-json/xmcp/v1/page/<id>` returns `{page_id, title, elements}`.
- Auth: HTTP Basic with `WP_USER:WP_APP_PASSWORD`. Some hosts strip `Authorization` before PHP, so also send the same value as `X-XMCP-Authorization: Basic …` and the raw base64 as `X-XMCP-Key`.
- Media upload: `POST /wp-json/wp/v2/media` with the file as body, `Content-Disposition: attachment; filename="x.png"` and the right `Content-Type`. Returns `id` + `source_url`.
- `get_page` output for a real page is huge (100KB+). Don't dump it into context: fetch it with a throwaway Node script in the scratchpad and print a compact tree (`id type text`) instead.

### First time on a site: learn its profile

Before building, find out and note (in the project's CLAUDE.md or memory, **not** in this skill):
- Which font families the site actually serves (check an existing page's computed `font-family`, or Elementor → Custom Fonts). Figma names often differ from the installed family name.
- The brand colours and heading/body sizes already used on other pages.
- The caching layer (host cache, WP Rocket, LiteSpeed, Autoptimize…) and how to purge it.
- Whether the host strips auth headers.

## 1. Read the design (Figma MCP)

1. Call `get_design_context` on the node from the URL (`node-id=7-808` → `7:808`). The React/Tailwind output is only a spec: read sizes, gaps, colours, font weights and letter-spacing from it.
2. If you don't know the node, run `get_metadata` on the page (`0:1`). The result is big and gets saved to a file; grep it (`name="…"` holds the text of text layers, so you can find sections by their copy and diff two frames' copy).
3. Assets:
   - Image fills come back as asset URLs (7-day expiry) at **source resolution**. Download them, don't hotlink.
   - `get_screenshot` never renders above 1x. For a crisp 2x asset, rebuild it from source assets (see "Images").
   - Main components that live off-canvas can't be screenshotted ("invalid node selection"): screenshot an **instance** on the canvas and crop.
4. Figma often shows only one state (e.g. the first tab open). Ask for the copy/images of the other states, or clearly mark them as draft. Never invent customer testimonials or quotes on a live site; use an obvious placeholder ("Customer Name / Job Title, Company" + "Placeholder testimonial — replace…").
5. Designers leave copy mistakes (e.g. a cloned frame still naming the old subject). Point them out, and fix them when the page's intent is clear.

## 2. Read the page, then plan

- Print a compact tree of the page to see ids, types and text. Reuse its id naming convention for new elements.
- Match the surrounding conventions (other headings' colour, size, line-height), not just the Figma numbers. Users notice inconsistency between sections more than a 2px drift.
- Plan responsive up front: desktop, laptop (≤1366), tablet (≤1024), mobile (≤767).

## 3a. New page from scratch (`create_page`)

The easiest way to build a whole new page. `mcp__elementor__create_page({ title, status?, pageId?, template?, elements })` takes a simple **node spec**, converts it to Elementor JSON and returns the page id, edit URL and view URL. Default status is `draft`; `template: "elementor_canvas"` gives a page without the theme header/footer; passing `pageId` **overwrites** that page.

Node types:
| type | fields |
|---|---|
| `container` | `direction` (`row`/`column`), `width` (`full`/`boxed`), `widthPct` (column width in %), `hug` (fit-content, e.g. pills/badges), `gap`, `justify`, `align`, `wrap`, `padding`, `margin` (number or `{top,right,bottom,left}`), `background` (`#hex`), `minHeight`, `borderRadius` (number or per-corner `{top:TL,right:TR,bottom:BR,left:BL}`), `children` |
| `heading` | `text` (HTML ok, e.g. `<br>`, `<span style>`), `level` (`h1`–`h6`/`div`/`p`), `align`, `color`, `typography` |
| `text` | `html`, `align`, `color`, `typography` |
| `image` | `url`, `imageId` (media id — upload first), `align`, `width` (px), `borderRadius`, `alt` |
| `button` | `text`, `link`, `align`, `background`, `color`, `borderRadius`, `typography` |
| `spacer` | `size` (px) |
| `raw` | `element`: a full Elementor element object, passed through as-is (Pro widgets like Form, nested carousel, icon-box, custom CSS, responsive `_tablet/_mobile` keys) |

`typography = { fontFamily, fontSize, fontSizeUnit (px), fontWeight, lineHeight, lineHeightUnit (em), letterSpacing (px) }`.

Rules:
- **Every page section is its own top-level container** in `elements` (hero, features, CTA…). Never wrap the whole page in one outer container.
- Mirror Figma auto-layout: a horizontal auto-layout = `direction:"row"` container; its columns = child containers with `widthPct` (they must add up to ≤100 minus gaps, e.g. 48 + 48 with a gap).
- Inner containers get 10px padding by default. Where alignment matters pass `padding: {top:0,right:0,bottom:0,left:0}` — a plain `padding: 0` is ignored by the builder (falsy).
- Upload images first (WP media endpoint) and pass `url` + `imageId`.
- The spec has no responsive fields. Build desktop first, then add `_tablet`/`_mobile` settings with `update_element` (e.g. `flex_direction_tablet: "column"`, `width_tablet: {unit:"%",size:100}`), or use `raw` nodes.

Example (hero with two columns + CTA section):
```json
{ "title": "Landing", "status": "draft", "elements": [
  { "type": "container", "direction": "row", "width": "boxed", "gap": 40, "align": "center",
    "padding": { "top": 96, "right": 24, "bottom": 96, "left": 24 }, "children": [
      { "type": "container", "widthPct": 50, "gap": 24, "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 }, "children": [
          { "type": "container", "hug": true, "background": "#EEF", "borderRadius": 999,
            "padding": { "top": 6, "right": 14, "bottom": 6, "left": 14 },
            "children": [ { "type": "text", "html": "New" } ] },
          { "type": "heading", "level": "h1", "text": "Headline<br>second line",
            "typography": { "fontFamily": "<site font>", "fontSize": 56, "fontWeight": 600, "lineHeight": 1.1 } },
          { "type": "text", "html": "<p>Supporting copy.</p>" },
          { "type": "button", "text": "Get started", "link": "/signup", "borderRadius": 8 } ] },
      { "type": "container", "widthPct": 46, "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 }, "children": [
          { "type": "image", "url": "<uploaded url>", "imageId": 123, "alt": "Product screenshot" } ] } ] },
  { "type": "container", "direction": "column", "align": "center", "gap": 16, "background": "#111",
    "padding": { "top": 80, "right": 24, "bottom": 80, "left": 24 }, "children": [
      { "type": "heading", "text": "Ready?", "color": "#FFF", "align": "center" },
      { "type": "button", "text": "Contact us", "link": "/contact" } ] }
] }
```
After creating: open the edit URL / view URL, run section 4 (verify), then add responsive settings.

## 3b. Build / patch an existing page

- Small setting changes → `mcp__elementor__update_element`, one call per element (parallel is fine).
- Structural changes → a scratchpad Node script that: fetches the page fresh, **writes a backup JSON to the scratchpad**, mutates `elements`, checks for duplicate ids, then POSTs the whole tree with the page's **current** status. Make edits idempotent (remove the id you're about to insert first) so you can re-run after tweaks.
- New page from an existing one → deep-copy its `elements`, swap texts/images by id, then POST without `page_id` and with `status: "draft"`. Element ids can stay the same as the source page (Elementor scopes CSS per post).
- New ids: short and unique on the page. Duplicate ids make Elementor's per-element CSS bleed between elements.

Setting value shapes:
```js
const px  = size => ({ unit: 'px', size, sizes: [] });          // also '%', 'em'
const gap = n => ({ unit: 'px', size: n, column: String(n), row: String(n) });
const box = (t, r, b, l) => ({ unit: 'px', top: String(t), right: String(r), bottom: String(b), left: String(l), isLinked: t === r && r === b && b === l });
const img = (id, url, alt = '') => ({ url, id, alt, source: 'library', size: '' });
const type = (family, size, weight, lh) => ({ typography_typography: 'custom', typography_font_family: family,
  typography_font_weight: String(weight), typography_font_size: px(size), typography_line_height: lh });
```
Figma "Regular" = `400`, "Medium" = `500`, "SemiBold" = `600`, "Bold" = `700`.

### Recipes

- **Card**: container with `content_width:'full'`, `flex_direction:'column'`, `flex_gap`, `background_background:'classic'`, `background_color`, `border_radius` (box), `overflow:'hidden'`, `min_height` + `min_height_tablet: px(0)`.
- **Heading with a coloured second line**: `title: 'Line one<br><span style="color:#…">line two</span>'`. Use `<br>` where Figma breaks the line, then check the line count at 1280px.
- **Overlap text onto an image**: give the text container a negative top `_margin` and `z_index: 1`.
- **Nested Carousel** (`widgetType: 'nested-carousel'`): `carousel_items: slides.map(s => ({slide_title, _id: s.id}))` must match the child containers in order. Other keys: `slides_to_show(_tablet/_mobile)`, `autoplay:'yes'`, `autoplay_speed`, `infinite:'yes'`, `pause_on_hover:''`, `pause_on_interaction:''` (keeps playing), `arrows:''`, `pagination:'bullets'`, `image_spacing_custom(_tablet/_mobile)`. Autoplay never runs inside the editor; check the live page.
- **Click-to-open tabs**: a row container (class `xtabs`) with a left column of tab containers (class `xtab`, each holding a heading + text) and a right column (`xtab-media`) with one image per tab, in the same order. Add an HTML widget that toggles an `is-active` class on the clicked tab and its matching image. Stack both columns to full width on tablet and honour `prefers-reduced-motion`.
- **Bottom-aligned bento row**: `flex_direction:'row'`, `flex_direction_tablet:'column'`, `flex_align_items:'flex-end'`, `flex_align_items_tablet:'stretch'`; children get a fixed `width` % with `_flex_size:'none'` and `width_tablet: 100%`.
- **Two/three columns → tablet column**: parent `flex_direction_tablet:'column'` (+ `flex_align_items_tablet:'stretch'`), children `width_tablet: 100%`. Tighter gutters via `padding_tablet` / `padding_mobile` on the section's inner container.

### Images

Every raster should be the original source asset, or rebuilt at **2x**:
- **Image fill with a crop**: Figma renders it as an `<img>` inside an overflow-hidden box W×H with `left/top/width/height` percentages. Invert that in PIL: displayed size = `W·w%` × `H·h%`, scale = source px / displayed px, crop origin = `-left%·W·scale`, `-top%·H·scale`, then resize to `2W × 2H`. For `object-cover`, scale the source to cover `2W × 2H` and centre-crop.
- **Composite of several layers**: rebuild it with PIL at 2x, sampling exact colours from a 1x screenshot.
- **Graphic with text in it**: write an SVG using the Figma geometry and a `<text>` in the site font, then render it at 2x with `@resvg/resvg-js`. resvg ignores variable-font weights, so instance the VF first with fontTools `instancer`.
- Install helper tools in the scratchpad, never in the repo. Set the widget `width` to the 1x CSS size so the 2x file stays sharp.

## 4. Verify (don't skip — "saved" ≠ "looks right")

Open the live URL in the built-in browser with a cache-buster (`?nocache=N`):
- Resize to 375, 768, 1024, 1280, 1366, 1440 and 1920. At each width, run a JS check for: elements whose right edge is past `clientWidth` (ignore `.swiper` internals), heading line counts (`height / lineHeight`), and headings/text whose computed `font-family` isn't the site font.
- Screenshots of a scrolled page are unreliable in the preview pane; trust JS measurements.
- `document.hidden` is true when the pane is hidden, which freezes Swiper autoplay and CSS transitions. That isn't a bug on the site.
- Lazy images measure ~24px tall until scrolled into view.
- Draft pages don't render logged-out: verify via REST `wp/v2/pages/<id>?context=edit` → `content.rendered`.
- Reset the viewport when done.

## 5. Hand-off message (every time)

Tell the user, briefly, in their language (Roman Urdu is fine):
1. What changed and what you verified (at which widths).
2. **Refresh the Elementor editor before editing.** An editor tab opened before your save will overwrite the whole page when they click Update/Publish. Ask them to tell you when they're editing, so you don't save concurrently.
3. **Purge the site/host cache.** Combined CSS lags until it is purged.
4. Anything drafted or placeholder, and any Figma inconsistencies.

## Gotchas (Elementor)

**Fonts**: use the family name exactly as the site has it installed. A name that doesn't exist silently falls back to the default font (often Arial). Check the whole page for `*font_family` values that aren't installed.

**Keys that silently do nothing if wrong**
- Container CSS class: `css_classes`. Widget CSS class: `_css_classes`.
- Nested Carousel: wrong keys (or a `carousel_items` count that doesn't match the children) ⇒ Elementor falls back to 3 default slides and a 10px gap.
- Image opacity: `opacity: {unit:'px', size:0.66}` (not `_opacity`).
- The image-box icon width defaults to 30% of the box, which is huge on tablet/mobile. Set `image_size_tablet/_mobile: px(56)`. `position_tablet` may not be honoured; stack with custom CSS (`selector .elementor-image-box-wrapper{display:flex;flex-direction:column;align-items:center}` inside `@media (max-width:1024px)`).
- Responsive suffixes: `_widescreen`, `_laptop` (≤1366), `_tablet` (≤1024), `_mobile` (≤767).

**Layout**
- Every container has a default 10px padding. Set `padding` to 0 where alignment matters (a heading not lining up with a neighbour's top is usually this).
- `custom_css` (Pro) uses `selector`. `selector{max-width:…}` on a widget is overridden by Elementor's `max-width:100%`, so put it on the inner node: `selector .elementor-heading-title{max-width:600px;margin:0 auto}`.
- Nested carousel dots: Elementor adds `left:50%;transform:translateX(-50%)`. If you make them `position:static`, also set `left:auto;transform:none`.
- Side-by-side rows must switch to `flex_direction_tablet:'column'` + child `width_tablet: 100%`. Users expect tablet (768) to look like mobile.
- For controlled line breaks, put `<br>` in the heading title rather than relying on widths.

**Safety**
- Treat the site as live. New pages → `status: "draft"`. Full-page saves overwrite concurrent editor work, so always back up to the scratchpad first.
- Keep `status` as it was when re-saving an existing page.
