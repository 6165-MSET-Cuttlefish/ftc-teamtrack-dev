/** Tiny zero-dependency console logger with a little color. */

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: (s: string) => paint('1', s),
  dim: (s: string) => paint('2', s),
  red: (s: string) => paint('31', s),
  green: (s: string) => paint('32', s),
  yellow: (s: string) => paint('33', s),
  blue: (s: string) => paint('34', s),
  cyan: (s: string) => paint('36', s),
};

export const log = {
  step: (msg: string) => console.log(`${c.cyan('▸')} ${msg}`),
  info: (msg: string) => console.log(`  ${c.dim(msg)}`),
  ok: (msg: string) => console.log(`${c.green('✓')} ${msg}`),
  warn: (msg: string) => console.warn(`${c.yellow('!')} ${msg}`),
  error: (msg: string) => console.error(`${c.red('✗')} ${msg}`),
  blank: () => console.log(''),
};
