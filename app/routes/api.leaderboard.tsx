import type { Route } from "./+types/api.leaderboard";
import { prisma } from "../db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [topBuilders, totalCount] = await Promise.all([
    prisma.builder.findMany({
      where: { paid: true, totalTokens: { gt: 0 } },
      select: {
        githubUsername: true,
        city: true,
        totalTokens: true,
        verified: true,
        provider: true,
      },
      orderBy: { totalTokens: "desc" },
      take: 10,
    }),
    prisma.builder.count({ where: { paid: true } }),
  ]);

  return Response.json({
    totalCount,
    builders: topBuilders.map((b, i) => ({
      rank: i + 1,
      name: b.githubUsername || "anon",
      city: b.city,
      tokens: b.totalTokens.toString(),
      verified: b.verified,
      provider: b.provider,
    })),
  });
}
