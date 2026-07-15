const HEX = '0123456789abcdef';

/**
 * Elementor element ids are short random hex-like strings (7 chars).
 */
export function elId(): string {
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += HEX[Math.floor(Math.random() * HEX.length)];
  }
  return s;
}
