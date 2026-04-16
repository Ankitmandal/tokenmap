import type { Route } from "./+types/api.tiles";
import { prisma } from "../db.server";

// Returns all verified users with location data for map rendering
export async function loader({ request }: Route.LoaderArgs) {
  const tiles = await prisma.builder.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      id: true,
      githubUsername: true,
      city: true,
      lat: true,
      lng: true,
      totalTokens: true,
      verified: true,
      provider: true,
    },
    orderBy: { totalTokens: "desc" },
    take: 200, // cap for performance
  });

  return Response.json({
    tiles: tiles.map((t) => ({
      id: t.id,
      name: t.githubUsername || `Builder #${t.id}`,
      city: t.city,
      lat: t.lat,
      lng: t.lng,
      tokens: Number(t.totalTokens),
      tokensFormatted: formatTokens(Number(t.totalTokens)),
      verified: t.verified,
      provider: t.provider,
      size: tokenToSize(Number(t.totalTokens)),
    })),
  });
}

function tokenToSize(tokens: number): number {
  // Tile size tiers
  if (tokens >= 100_000_000) return 28; // whale
  if (tokens >= 10_000_000) return 22;  // heavy hitter
  if (tokens >= 1_000_000) return 17;   // power builder
  if (tokens >= 100_000) return 13;     // builder
  if (tokens >= 10_000) return 10;      // hobbyist
  return 8; // starter
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n === 0) return "unverified";
  return String(n);
}
