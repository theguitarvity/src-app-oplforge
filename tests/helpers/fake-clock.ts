export function fakeClock(iso = '2026-01-01T00:00:00.000Z'): () => Date {
  const instant = new Date(iso)
  return () => new Date(instant)
}
