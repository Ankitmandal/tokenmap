// Tier system — the persistent identity
export interface Tier {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  min: number;
  max: number;
  color: string; // tailwind color
}

export const TIERS: Tier[] = [
  { id: "sprout",      name: "Sprout",      emoji: "🌱", tagline: "just getting started",                                 min: 0,              max: 10_000_000,      color: "green-400" },
  { id: "sparker",     name: "Sparker",     emoji: "⚡", tagline: "warming up",                                           min: 10_000_000,     max: 100_000_000,     color: "yellow-400" },
  { id: "combustor",   name: "Combustor",   emoji: "🔥", tagline: "now you're cooking",                                   min: 100_000_000,    max: 500_000_000,     color: "orange-400" },
  { id: "detonator",   name: "Detonator",   emoji: "💥", tagline: "prolific",                                             min: 500_000_000,    max: 1_000_000_000,   color: "orange-500" },
  { id: "volcano",     name: "Volcano",     emoji: "🌋", tagline: "climate activists want to know your location",        min: 1_000_000_000,  max: 5_000_000_000,   color: "red-400" },
  { id: "inferno",     name: "Inferno",     emoji: "☄️",  tagline: "Anthropic's GPU priority list starts with your name", min: 5_000_000_000,  max: 20_000_000_000,  color: "red-500" },
  { id: "singularity", name: "Singularity", emoji: "🌌", tagline: "a geological force",                                   min: 20_000_000_000, max: Number.MAX_SAFE_INTEGER, color: "purple-400" },
];

export function getTier(totalTokens: number): Tier {
  for (const t of TIERS) {
    if (totalTokens >= t.min && totalTokens < t.max) return t;
  }
  return TIERS[TIERS.length - 1];
}

export function getNextTier(totalTokens: number): Tier | null {
  const current = getTier(totalTokens);
  const idx = TIERS.findIndex((t) => t.id === current.id);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export function getTierProgress(totalTokens: number): number {
  const current = getTier(totalTokens);
  const range = current.max - current.min;
  const into = totalTokens - current.min;
  return Math.min(1, into / range);
}
