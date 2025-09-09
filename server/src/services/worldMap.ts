import crypto from 'crypto';

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seedToInt(seed: string) {
  const h = crypto.createHash('sha1').update(seed).digest();
  return h.readUInt32BE(0);
}

export function getChunkPOIIds(seed: string, chunkId: string): string[] {
  const [cx, cy] = chunkId.split(':').map((v) => parseInt(v, 10));
  const s = seedToInt(`${seed}:poi:${cx},${cy}`);
  const rnd = mulberry32(s);
  const count = Math.floor(rnd() * 3); // 0..2 POIs per chunk
  const res: string[] = [];
  for (let i = 0; i < count; i++) {
    const templateIdx = Math.floor(rnd() * 8); // aligns with manifest length
    res.push(`poi:${cx}:${cy}:${templateIdx}:${i}`);
  }
  return res;
}

export function getChunkNPCIds(seed: string, chunkId: string): string[] {
  const [cx, cy] = chunkId.split(':').map((v) => parseInt(v, 10));
  const s = seedToInt(`${seed}:npc:${cx},${cy}`);
  const rnd = mulberry32(s);
  const count = Math.floor(rnd() * 4); // 0..3 NPCs
  const res: string[] = [];
  for (let i = 0; i < count; i++) {
    const roleIdx = Math.floor(rnd() * 5);
    res.push(`npc:${cx}:${cy}:${roleIdx}:${i}`);
  }
  return res;
}

