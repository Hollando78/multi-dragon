type Flags = {
  canarySeeds?: string[];
  features?: Record<string, boolean>;
};

let flags: Flags = { features: {} };

export function loadFlagsFromEnv() {
  try {
    if (process.env.FEATURE_FLAGS) flags = JSON.parse(process.env.FEATURE_FLAGS);
  } catch {}
}

export function getFlags() { return flags; }
export function isFeatureEnabled(name: string) { return !!flags.features?.[name]; }
export function isCanarySeed(seed: string) { return !!flags.canarySeeds?.includes(seed); }

