#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load .env from the project root (one level up from dist/), regardless of cwd —
// Claude Code launches this server with cwd set to the host project, not here.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '..', '.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { wp } from './wpClient.js';
import { buildTree, type Node } from './elementor/builder.js';

const server = new McpServer({ name: 'elementor-mcp', version: '0.1.0' });

const NODE_SPEC_DOC = `A node spec is one of:
- { "type":"container", direction?:"row"|"column", width?:"full"|"boxed", gap?:number,
    justify?:..., align?:..., wrap?:"wrap"|"nowrap", padding?:{top,right,bottom,left},
    margin?:{...}, background?:"#hex", minHeight?:number, borderRadius?:number, children?:Node[] }
- { "type":"heading", text, level?:"h1".."h6"|"div"|"p", align?, color?, typography? }
- { "type":"text", html, align?, color?, typography? }
- { "type":"image", url, imageId?, align?, width?, borderRadius?, alt? }
- { "type":"button", text, link?, align?, background?, color?, borderRadius?, typography? }
- { "type":"spacer", size? }
- { "type":"raw", element: <a full Elementor element object> }
typography = { fontFamily?, fontSize?, fontSizeUnit?, fontWeight?, lineHeight?, lineHeightUnit?, letterSpacing? }.
Layout uses Elementor Containers (flexbox); nest containers to mirror Figma auto-layout.`;

server.tool(
  'create_page',
  `Create (or update, if page_id is given) an Elementor page from a Container-based node spec.
Returns the new page id plus its Elementor edit URL and public view URL.
${NODE_SPEC_DOC}`,
  {
    title: z.string().describe('Page title'),
    status: z.enum(['publish', 'draft']).optional().describe('Defaults to draft'),
    pageId: z.number().optional().describe('Pass to overwrite an existing page'),
    template: z
      .string()
      .optional()
      .describe('Optional WP page template, e.g. "elementor_canvas" for a header/footer-less full canvas'),
    elements: z.array(z.any()).describe('Array of top-level node specs (usually containers)')
  },
  async ({ title, status, pageId, template, elements }) => {
    const built = buildTree(elements as Node[]);
    const res = await wp.createPage({
      title,
      status: status ?? 'draft',
      page_id: pageId,
      template,
      elements: built
    });
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  'get_page',
  'Read the current Elementor element tree (with element ids) of a page. Use the ids with update_element.',
  {
    pageId: z.number().describe('WordPress page id')
  },
  async ({ pageId }) => {
    const res = await wp.getPage(pageId);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  'update_element',
  'Merge new Elementor settings into a single element (found by its id) on a page, then re-save and regenerate CSS.',
  {
    pageId: z.number().describe('WordPress page id'),
    elementId: z.string().describe('The "id" of the element to edit (from get_page)'),
    settings: z.record(z.any()).describe('Elementor settings keys to merge, e.g. { "title_color": "#ff0000" }')
  },
  async ({ pageId, elementId, settings }) => {
    const res = await wp.updateElement({ page_id: pageId, element_id: elementId, settings });
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP channel.
  console.error('elementor-mcp server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
