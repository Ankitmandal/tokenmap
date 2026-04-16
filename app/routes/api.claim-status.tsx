import type { Route } from "./+types/api.claim-status";
import { claimStatsCache } from "./api.claim";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 400 });
  }

  const cached = claimStatsCache.get(token);

  if (!cached) {
    return Response.json({ claimed: false });
  }

  return Response.json({
    claimed: true,
    stats: cached.stats,
    claimedAt: cached.claimedAt,
  });
}
