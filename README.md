# Elementor MCP

Build and edit **Elementor** pages programmatically — designed so an AI agent can read a Figma
design and recreate it on a WordPress + Elementor site using **native Elementor elements**
(Container/flexbox based), then edit them afterwards.

## Pieces

```
elementor-mcp/
├── wp-plugin/
│   ├── elementor-mcp-bridge.php   # WordPress companion plugin (REST bridge to Elementor)
│   └── elementor-mcp-bridge.zip   # same plugin, zipped for one-click WP upload
└── mcp-server/                    # Node/TypeScript MCP server (talks to the plugin)
    ├── src/
    │   ├── index.ts               # MCP tools: create_page / get_page / update_element
    │   ├── wpClient.ts            # WP REST client (app-password auth)
    │   ├── config.ts
    │   └── elementor/
    │       ├── builder.ts         # friendly node spec  ->  valid Elementor JSON
    │       ├── values.ts          # Elementor value helpers (sliders, dimensions, gap)
    │       └── ids.ts
    └── .env.example
```

## How it fits together

1. **Claude** reads the Figma frame via the Figma Dev Mode MCP (`get_metadata`, `get_variable_defs`,
   `get_screenshot`) and turns it into a **node spec** (containers + heading/text/image/button/...).
2. Claude calls this MCP's **`create_page`** tool with that spec.
3. The MCP server converts the spec to Elementor's `_elementor_data` JSON and POSTs it to the
   WordPress plugin.
4. The plugin saves it through Elementor's document API (so CSS is regenerated) and returns the
   edit/view URLs.
5. For tweaks, Claude calls **`update_element`** with an element id + settings.

## Setup

### 1. WordPress plugin
- **Easiest:** WP Admin → Plugins → Add New → Upload Plugin → upload `wp-plugin/elementor-mcp-bridge.zip` → Activate.
  (Or manually copy `wp-plugin/elementor-mcp-bridge.php` into `wp-content/plugins/elementor-mcp-bridge/`.)
- **Elementor must be active** on the site — the bridge won't work without it.
- Activate **Elementor MCP Bridge** in WP Admin → Plugins.
- Create an **Application Password**: WP Admin → Users → Profile → Application Passwords (copy it — shown once).

### 2. MCP server
```bash
git clone https://github.com/osama-humayun-spursol/elementor-mcp.git
cd elementor-mcp/mcp-server
cp .env.example .env      # fill in WP_BASE_URL / WP_USER / WP_APP_PASSWORD
npm install               # node_modules is not committed
npm run build             # builds dist/ (also not committed)
```

### 3. Register the MCP with Claude Code
```bash
# use the absolute path to dist/index.js on YOUR machine
claude mcp add elementor -- node /absolute/path/to/elementor-mcp/mcp-server/dist/index.js
```
(or add it to `.mcp.json`).

## Status
MVP: `create_page`, `get_page`, `update_element`. Core/free widgets:
container, heading, text-editor, image, button, spacer, plus `raw` passthrough for any Elementor
element. Elementor **Pro** widgets can be added to the builder later.
