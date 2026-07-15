import { elId } from './ids.js';
import { dimensions, gap, slider, uniform, type SpacingInput, type Unit } from './values.js';
import type { ElementorElement } from '../wpClient.js';

// ---- Friendly spec the agent writes (much simpler than raw Elementor JSON) ----

export interface Typography {
  fontFamily?: string;
  fontSize?: number;
  fontSizeUnit?: Unit;
  fontWeight?: number | string;
  lineHeight?: number;
  lineHeightUnit?: Unit;
  letterSpacing?: number;
}

export interface ContainerNode {
  type: 'container';
  direction?: 'row' | 'column';
  width?: 'full' | 'boxed';
  gap?: number;
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  wrap?: 'wrap' | 'nowrap';
  padding?: SpacingInput | number;
  margin?: SpacingInput | number;
  background?: string;
  minHeight?: number;
  borderRadius?: number;
  children?: Node[];
}

export interface HeadingNode {
  type: 'heading';
  text: string;
  level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'p';
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  typography?: Typography;
}

export interface TextNode {
  type: 'text';
  html: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  typography?: Typography;
}

export interface ImageNode {
  type: 'image';
  url: string;
  imageId?: number;
  align?: 'left' | 'center' | 'right';
  width?: number;
  borderRadius?: number;
  alt?: string;
}

export interface ButtonNode {
  type: 'button';
  text: string;
  link?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  background?: string;
  color?: string;
  borderRadius?: number;
  typography?: Typography;
}

export interface SpacerNode {
  type: 'spacer';
  size?: number;
}

/** Escape hatch: pass a raw Elementor element straight through. */
export interface RawNode {
  type: 'raw';
  element: ElementorElement;
}

export type Node =
  | ContainerNode
  | HeadingNode
  | TextNode
  | ImageNode
  | ButtonNode
  | SpacerNode
  | RawNode;

// ---- Builder ----

function applyTypography(settings: Record<string, unknown>, prefix: string, t?: Typography): void {
  if (!t) return;
  settings[`${prefix}_typography`] = 'custom';
  if (t.fontFamily) settings[`${prefix}_font_family`] = t.fontFamily;
  if (t.fontSize != null) settings[`${prefix}_font_size`] = slider(t.fontSize, t.fontSizeUnit ?? 'px');
  if (t.fontWeight != null) settings[`${prefix}_font_weight`] = String(t.fontWeight);
  if (t.lineHeight != null) settings[`${prefix}_line_height`] = slider(t.lineHeight, t.lineHeightUnit ?? 'em');
  if (t.letterSpacing != null) settings[`${prefix}_letter_spacing`] = slider(t.letterSpacing, 'px');
}

function widget(widgetType: string, settings: Record<string, unknown>): ElementorElement {
  return { id: elId(), elType: 'widget', widgetType, settings, elements: [] };
}

function buildContainer(node: ContainerNode): ElementorElement {
  const s: Record<string, unknown> = {
    content_width: node.width ?? 'full'
  };
  if (node.direction) s.flex_direction = node.direction;
  if (node.gap != null) s.flex_gap = gap(node.gap);
  if (node.justify) s.flex_justify_content = node.justify;
  if (node.align) s.flex_align_items = node.align;
  if (node.wrap) s.flex_wrap = node.wrap;
  if (node.padding) s.padding = dimensions(node.padding);
  if (node.margin) s.margin = dimensions(node.margin);
  if (node.minHeight != null) s.min_height = slider(node.minHeight);
  if (node.borderRadius != null) s.border_radius = uniform(node.borderRadius);
  if (node.background) {
    s.background_background = 'classic';
    s.background_color = node.background;
  }

  return {
    id: elId(),
    elType: 'container',
    settings: s,
    elements: (node.children ?? []).map(build),
    isInner: false
  };
}

export function build(node: Node): ElementorElement {
  switch (node.type) {
    case 'container':
      return buildContainer(node);

    case 'heading': {
      const s: Record<string, unknown> = { title: node.text, header_size: node.level ?? 'h2' };
      if (node.align) s.align = node.align;
      if (node.color) s.title_color = node.color;
      applyTypography(s, 'typography', node.typography);
      return widget('heading', s);
    }

    case 'text': {
      const s: Record<string, unknown> = { editor: node.html };
      if (node.align) s.align = node.align;
      if (node.color) s.text_color = node.color;
      applyTypography(s, 'typography', node.typography);
      return widget('text-editor', s);
    }

    case 'image': {
      const s: Record<string, unknown> = {
        image: { url: node.url, id: node.imageId ?? '', alt: node.alt ?? '' }
      };
      if (node.align) s.align = node.align;
      if (node.width != null) s.width = slider(node.width);
      if (node.borderRadius != null) s.image_border_radius = uniform(node.borderRadius);
      return widget('image', s);
    }

    case 'button': {
      const s: Record<string, unknown> = { text: node.text };
      if (node.link) s.link = { url: node.link, is_external: '', nofollow: '' };
      if (node.align) s.align = node.align;
      if (node.background) s.background_color = node.background;
      if (node.color) s.button_text_color = node.color;
      if (node.borderRadius != null) s.border_radius = uniform(node.borderRadius);
      applyTypography(s, 'typography', node.typography);
      return widget('button', s);
    }

    case 'spacer':
      return widget('spacer', { space: slider(node.size ?? 50) });

    case 'raw':
      return node.element;

    default: {
      const exhaustive: never = node;
      throw new Error(`Unknown node type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function buildTree(nodes: Node[]): ElementorElement[] {
  return nodes.map(build);
}
