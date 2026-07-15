// Helpers that produce the value shapes Elementor expects in settings.

export type Unit = 'px' | '%' | 'em' | 'rem' | 'vw' | 'vh';

export interface SpacingInput {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  isLinked?: boolean;
}

/** Slider control value, e.g. font-size, width, min-height, spacer. */
export function slider(size: number, unit: Unit = 'px') {
  return { unit, size, sizes: [] as number[] };
}

/** Flex gap control value (column/row gap). */
export function gap(size: number, unit: Unit = 'px') {
  return { unit, size, column: String(size), row: String(size) };
}

/** Dimensions control value, e.g. padding / margin / border-radius.
 * Accepts a full {top,right,bottom,left} object, or a single number for uniform sides. */
export function dimensions(input: SpacingInput | number, unit: Unit = 'px') {
  if (typeof input === 'number') {
    return { unit, top: String(input), right: String(input), bottom: String(input), left: String(input), isLinked: true };
  }
  const { top = '', right = '', bottom = '', left = '', isLinked = false } = input;
  return {
    unit,
    top: String(top),
    right: String(right),
    bottom: String(bottom),
    left: String(left),
    isLinked
  };
}

/** Same value on all four sides (handy for uniform border-radius). */
export function uniform(value: number, unit: Unit = 'px') {
  return dimensions({ top: value, right: value, bottom: value, left: value, isLinked: true }, unit);
}
