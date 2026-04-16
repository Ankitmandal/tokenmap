import type { Route } from "./+types/api.claim";
import { prisma } from "../db.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { token, stats } = body as {
    token?: string;
    stats?: {
      totalTokens: number;
      totalFormatted: string;
      inputTokens: number;
      outputTokens: number;
      cacheCreation: number;
      cacheRead: number;
      filesScanned: number;
      messagesFound: number;
      sessions: number;
      activeDays: number;
      daySpan: number;
      activeSince: string;
      lastActive: string;
      topModel: string;
      topModelCount: number;
      models: { name: string; count: number }[];
      topProject: string;
      topProjectCount: number;
      projects: { name: string; count: number }[];
      topTools: { name: string; count: number }[];
      totalToolCalls: number;
      peakDay: string;
      peakDayTokens: number;
      peakDayFormatted: string;
      longestSessionTokens: number;
      longestSessionFormatted: string;
    };
  };

  if (!token || !stats) {
    return Response.json({ error: "Token and stats required" }, { status: 400 });
  }

  if (!stats.totalTokens || stats.totalTokens <= 0) {
    return Response.json({ error: "No tokens found in scan" }, { status: 400 });
  }

  // Find builder by claim code (short) or referral code (UUID fallback)
  let builder = await prisma.builder.findUnique({
    where: { claimCode: token },
  });
  if (!builder) {
    builder = await prisma.builder.findUnique({
      where: { referralCode: token },
    });
  }

  if (!builder) {
    return Response.json({ error: "Invalid claim token. Sign up at tokenmap.dev first." }, { status: 404 });
  }

  // Build projects array with default visibility
  const projectsData = (stats.projects || []).map((p: { name: string; count: number }) => ({
    name: p.name,
    messages: p.count,
    visibility: "public" as const, // default to public, user can change later
    url: "",
  }));

  // Update builder with verified stats + projects
  await prisma.builder.update({
    where: { id: builder.id },
    data: {
      totalTokens: BigInt(stats.totalTokens),
      provider: "claude-code",
      verified: true,
      verifiedAt: new Date(),
      projects: projectsData,
    },
  });

  // Store the full stats as JSON for the website to display
  // We'll use a simple approach: store in a separate table or as a JSON field
  // For now, store in a lightweight cache mechanism
  // The website polls /api/claim-status which returns these stats

  // Store stats in memory cache (good enough for MVP — single server)
  // Store under both claimCode and referralCode so polling works regardless
  const cacheEntry = { stats, claimedAt: Date.now() };
  claimStatsCache.set(builder.claimCode, cacheEntry);
  claimStatsCache.set(builder.referralCode, cacheEntry);

  // Clean old entries (older than 1 hour)
  for (const [key, val] of claimStatsCache.entries()) {
    if (Date.now() - val.claimedAt > 3600000) {
      claimStatsCache.delete(key);
    }
  }

  // Calculate rank
  const rank = await prisma.builder.count({
    where: {
      totalTokens: { gte: BigInt(stats.totalTokens) },
    },
  });

  return Response.json({
    success: true,
    rank,
    totalTokens: stats.totalTokens.toString(),
    name: builder.githubUsername || builder.email.split("@")[0],
    city: builder.city,
  });
}

// In-memory cache for claim stats (polled by website)
export const claimStatsCache = new Map<string, { stats: any; claimedAt: number }>();
