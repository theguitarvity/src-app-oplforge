export function fakeId(prefix = 'op'): () => string {
  let sequence = 0
  return () => `${prefix}-${String(++sequence).padStart(4, '0')}`
}
