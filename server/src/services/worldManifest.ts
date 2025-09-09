import crypto from 'crypto';

export function manifestForSeed(seed: string) {
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  const biomeIndex = parseInt(h.slice(0, 2), 16) % 5; // 5 biomes for demo
  const biomes = ['forest', 'desert', 'tundra', 'swamp', 'highlands'];
  const chunkSize = 64;
  const typePool = ['village', 'breeding_center', 'market', 'ruins'];
  const poiTemplates = Array.from({ length: 8 }).map((_, i) => {
    const type = typePool[(parseInt(h.slice(2 + i, 4 + i), 16) + i) % typePool.length];
    return {
      id: `${i}`,
      type,
      hash: crypto.createHash('sha1').update(`${seed}:${type}:${i}`).digest('hex'),
    };
  });
  return {
    seed,
    version: 1,
    chunkSize,
    world: {
      biome: biomes[biomeIndex],
      poiTemplates,
      npcTemplateHash: crypto.createHash('sha1').update(`${seed}:npcTemplates:v1`).digest('hex'),
    },
  };
}

