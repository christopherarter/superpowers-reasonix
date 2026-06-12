export function parseConfig(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
