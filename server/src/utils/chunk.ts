export function getChunkId(x: number, y: number, chunkSize: number): string {
  const cx = Math.floor(x / chunkSize);
  const cy = Math.floor(y / chunkSize);
  return `${cx}:${cy}`;
}

