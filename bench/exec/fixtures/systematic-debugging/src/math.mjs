export function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s[mid]; // BUG: wrong for even-length arrays
}
