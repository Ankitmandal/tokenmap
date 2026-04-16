import type { Route } from "./+types/profile";
import { prisma } from "../db.server";

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function meta({ data }: Route.MetaArgs) {
  const d = data as any;
  if (!d?.builder) return [{ title: "User not found — TokenMap" }];
  return [
    { title: `${d.builder.name} — TokenMap` },
    { name: "description", content: `${d.builder.name} has burned ${d.builder.tokensFormatted} tokens. #${d.builder.rank} on TokenMap.` },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const username = params.username;

  const builder = await prisma.builder.findFirst({
    where: { githubUsername: username },
    select: {
      githubUsername: true,
      city: true,
      totalTokens: true,
      verified: true,
      paid: true,
      projects: true,
      createdAt: true,
    },
  });

  if (!builder || !builder.paid) {
    throw new Response("Not found", { status: 404 });
  }

  // Calculate rank
  const rank = await prisma.builder.count({
    where: {
      paid: true,
      totalTokens: { gte: builder.totalTokens },
    },
  });

  const tokens = Number(builder.totalTokens);

  // Filter projects to only public/building ones
  const allProjects = (builder.projects as any[]) || [];
  const visibleProjects = allProjects.filter(
    (p) => p.visibility === "public" || p.visibility === "building"
  );

  return {
    builder: {
      name: builder.githubUsername || "anon",
      city: builder.city,
      tokens,
      tokensFormatted: formatTokens(tokens),
      verified: builder.verified,
      rank,
      joinedAt: builder.createdAt.toISOString().split("T")[0],
    },
    projects: visibleProjects,
  };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { builder, projects } = loaderData;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#050510" }}>
      <div className="w-full max-w-md">
        {/* Profile card */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: "rgba(5,5,16,0.95)" }}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500/30 flex items-center justify-center mx-auto mb-3">
              <span className="text-orange-400 text-2xl font-bold">{builder.name.charAt(0).toUpperCase()}</span>
            </div>
            <h1 className="text-xl font-bold">{builder.name}</h1>
            <p className="text-white/30 text-[12px] mt-1 flex items-center justify-center gap-2">
              {builder.city}
              {builder.verified && <span className="text-green-400/70 text-[10px]">✓ verified</span>}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.04] mx-5 rounded-lg overflow-hidden mb-5">
            <div className="bg-black/40 py-3 text-center">
              <p className="text-orange-400 font-bold text-[18px]">{builder.tokensFormatted}</p>
              <p className="text-white/20 text-[10px]">tokens</p>
            </div>
            <div className="bg-black/40 py-3 text-center">
              <p className="text-white font-bold text-[18px]">#{builder.rank}</p>
              <p className="text-white/20 text-[10px]">rank</p>
            </div>
            <div className="bg-black/40 py-3 text-center">
              <p className="text-white font-bold text-[18px]">{projects.length}</p>
              <p className="text-white/20 text-[10px]">projects</p>
            </div>
          </div>

          {/* Projects */}
          {projects.length > 0 && (
            <div className="px-5 pb-5">
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-3">Projects</p>
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{p.name}</span>
                        {p.visibility === "building" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400/70 font-medium">
                            building
                          </span>
                        )}
                      </div>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400/60 text-[11px] hover:text-orange-400 transition truncate block"
                        >
                          {p.url.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                    <span className="text-white/15 text-[10px] font-mono shrink-0">
                      {formatTokens(p.messages)} msgs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <p className="text-white/10 text-[10px]">
              Joined {builder.joinedAt}
            </p>
            <a
              href="/"
              className="text-orange-400/50 text-[11px] hover:text-orange-400 transition"
            >
              tokenmap.dev
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
