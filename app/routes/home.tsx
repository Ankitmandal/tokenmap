import type { Route } from "./+types/home";
import { prisma } from "../db.server";
import { SignupForm } from "../components/SignupForm";
import { getTier } from "../lib/tiers";
import { useEffect, useState, lazy, Suspense } from "react";

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const RealMapViz = lazy(() =>
  import("../components/viz/RealMapViz").then((m) => ({
    default: m.RealMapViz,
  }))
);

export function meta({}: Route.MetaArgs) {
  return [
    { title: "TokenMap — The tokenmaxxing leaderboard" },
    {
      name: "description",
      content:
        "A world map of verified AI token usage. Your city is unranked.",
    },
    { property: "og:title", content: "TokenMap" },
    {
      property: "og:description",
      content: "Your city is unranked.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const [totalCount, topBuilders] = await Promise.all([
    prisma.builder.count({ where: { paid: true, totalTokens: { gt: BigInt(0) } } }),
    prisma.builder.findMany({
      where: { paid: true, totalTokens: { gt: BigInt(0) } },
      select: {
        githubUsername: true,
        city: true,
        totalTokens: true,
        verified: true,
      },
      orderBy: { totalTokens: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalCount,
    builders: topBuilders.map((b, i) => ({
      rank: i + 1,
      name: b.githubUsername || "anon",
      city: b.city,
      tokens: b.totalTokens.toString(),
      verified: b.verified,
    })),
  };
}

interface BuilderEntry {
  rank: number;
  name: string;
  city: string;
  tokens: string;
  verified: boolean;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { totalCount: initialTotal, builders: initialBuilders } = loaderData;
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [builders, setBuilders] = useState<BuilderEntry[]>(initialBuilders);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; city: string; tokens: string; verified: boolean; paid: boolean; claimCode: string; position: number; cityPosition: number; cityCount: number } | null>(null);
  const [restoringSession, setRestoringSession] = useState(false);

  // Restore session from localStorage OR handle ?paid=true return
  useEffect(() => {
    const url = new URL(window.location.href);
    const paidReturn = url.searchParams.get("paid") === "true";
    const emailReturn = url.searchParams.get("email");

    // Clean up URL params
    if (paidReturn) {
      window.history.replaceState({}, "", "/");
    }

    // If returning from payment, look up by email
    const stored = localStorage.getItem("tokenmap_user");
    const storedParsed = stored ? (() => { try { return JSON.parse(stored); } catch { return null; } })() : null;

    const email = emailReturn || storedParsed?.email;
    if (!email) return;

    setRestoringSession(true);

    // Use read-only lookup — never creates ghost accounts
    fetch(`/api/lookup?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.found) {
          // If returning from payment, treat as paid even if webhook hasn't fired yet
          const isPaid = data.paid || paidReturn;
          const user = {
            name: data.githubUsername || data.email.split("@")[0],
            email: data.email,
            city: data.city,
            tokens: data.totalTokens,
            verified: data.verified,
            paid: isPaid,
            claimCode: data.claimCode,
            position: data.position,
            cityPosition: data.cityPosition,
            cityCount: data.cityCount,
          };
          setCurrentUser(user);
          localStorage.setItem("tokenmap_user", JSON.stringify(user));
        } else {
          // User not found in DB — stale localStorage, clear it
          localStorage.removeItem("tokenmap_user");
        }
      })
      .catch(() => {})
      .finally(() => setRestoringSession(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setTotalCount(data.totalCount);
        setBuilders(data.builders);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  function refreshLeaderboard() {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setTotalCount(data.totalCount);
        setBuilders(data.builders);
      })
      .catch(() => {});
  }

  return (
    <div className="h-screen flex flex-col relative" style={{ background: "#050510" }}>
      {/* ── Map: full bleed background ── */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <Suspense
          fallback={
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "#0a0a1e" }}
            >
              <span className="text-white/15 text-sm animate-pulse">
                Loading map...
              </span>
            </div>
          }
        >
          <RealMapViz />
        </Suspense>
      </div>

      {/* Gradient overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1000,
          background:
            "linear-gradient(to bottom, rgba(5,5,16,0.75) 0%, rgba(5,5,16,0.1) 25%, rgba(5,5,16,0.05) 45%, rgba(5,5,16,0.3) 65%, rgba(5,5,16,0.85) 85%, rgba(5,5,16,0.95) 100%)",
        }}
      />

      {/* ── All UI content over the map ── */}
      <div className="absolute inset-0 flex flex-col pointer-events-none" style={{ zIndex: 1001 }}>
        {/* Nav */}
        <nav className="px-8 py-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-[10px] font-black tracking-tight">
              T
            </div>
            <span className="font-semibold text-[14px] tracking-tight text-white/80">
              TokenMap
            </span>
            {totalCount > 0 && (
              <span className="text-[11px] text-white/20 tabular-nums font-mono ml-3">
                {totalCount.toLocaleString()} on the map
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHowItWorks(true)}
              className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/5 transition"
            >
              How it works
            </button>
            <a
              href="mailto:hey@tokenmap.dev"
              className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/5 transition"
            >
              Contact
            </a>
            {currentUser && (
              <div className="relative ml-1">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="w-8 h-8 rounded-full bg-orange-500/20 border-orange-500/30 hover:bg-white/[0.12] border flex items-center justify-center transition"
                >
                  <span className="text-orange-400 text-[11px] font-bold">{currentUser.name.charAt(0).toUpperCase()}</span>
                </button>

                {showProfile && (
                  <>
                    <div className="fixed inset-0" onClick={() => setShowProfile(false)} />
                    <div
                      className="absolute right-0 top-10 w-56 rounded-xl border border-white/[0.1] p-1 shadow-2xl"
                      style={{ background: "rgba(5,5,16,0.95)", backdropFilter: "blur(12px)" }}
                    >
                      <div className="px-3 py-2.5 border-b border-white/[0.06]">
                        <p className="text-[13px] font-semibold">{currentUser.name}</p>
                        <p className="text-white/25 text-[10px] mt-0.5">{currentUser.email}</p>
                        <p className="text-white/20 text-[10px]">{currentUser.city}</p>
                      </div>
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/30 text-[10px]">Tokens</span>
                          <span className="text-orange-400 text-[11px] font-mono font-semibold">
                            {formatTokens(Number(currentUser.tokens))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-white/30 text-[10px]">Status</span>
                          <span className={`text-[10px] ${currentUser.verified ? 'text-green-400/70' : 'text-white/25'}`}>
                            {currentUser.verified ? '✓ Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-white/[0.06]">
                        {currentUser.name && (
                          <a
                            href={`/u/${currentUser.name}`}
                            className="block px-3 py-2 text-[11px] text-white/30 hover:text-white/60 transition"
                          >
                            View profile
                          </a>
                        )}
                        <button
                          onClick={() => {
                            localStorage.removeItem("tokenmap_user");
                            setCurrentUser(null);
                            setShowProfile(false);
                            window.location.reload();
                          }}
                          className="w-full text-left px-3 py-2 text-[11px] text-white/20 hover:text-red-400/60 transition"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Hero text */}
        <div className="px-8 pt-4 md:pt-8 pointer-events-auto">
          <p className="text-orange-400/70 text-[12px] font-medium tracking-widest uppercase mb-3">
            Tokenmaxxing leaderboard
          </p>
          <h1 className="text-[36px] md:text-[52px] font-bold leading-[1.05] tracking-tight max-w-[480px]">
            Every token you've burned,
            <br />
            <span className="text-white/25">on a map.</span>
          </h1>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom controls — right edge, vertically centered */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-auto">
          <button
            onClick={() => (window as any).__tokenmap?.zoomIn()}
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 border border-white/[0.08] flex items-center justify-center text-orange-400/70 hover:text-orange-400 transition text-[16px] font-light backdrop-blur-sm"
          >
            +
          </button>
          <button
            onClick={() => (window as any).__tokenmap?.zoomOut()}
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 border border-white/[0.08] flex items-center justify-center text-orange-400/70 hover:text-orange-400 transition text-[16px] font-light backdrop-blur-sm"
          >
            −
          </button>
        </div>

        {/* Bottom: leaderboard + signup */}
        <div className="px-8 pb-8 flex items-end justify-between gap-8 pointer-events-auto">
          {/* Leaderboard */}
          <div className="hidden md:block" style={{ width: "280px" }}>
            <div className="rounded-xl border border-white/[0.08] p-3" style={{ background: "rgba(5,5,16,0.85)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[13px] font-bold tracking-tight">Leaderboard</h2>
                <span className="text-[9px] text-white/15 font-mono">LIVE</span>
              </div>
              {builders.length > 0 ? (
                <div className="space-y-1">
                  {builders.map((b) => (
                    <div
                      key={b.name + b.rank}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md"
                      style={{ background: b.rank === 1 ? "rgba(249,115,22,0.06)" : "transparent" }}
                    >
                      <span className={`text-[10px] font-bold w-3 tabular-nums ${b.rank === 1 ? "text-orange-400" : "text-white/20"}`}>
                        {b.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium truncate">{b.name}</span>
                          <span className="text-[11px]" title={getTier(Number(b.tokens)).name}>{getTier(Number(b.tokens)).emoji}</span>
                          {b.verified && (
                            <span className="text-green-400/60 text-[8px]">✓</span>
                          )}
                        </div>
                        <span className="text-white/15 text-[9px]">{b.city}</span>
                      </div>
                      <span className="text-orange-400/50 text-[10px] tabular-nums font-mono">
                        {formatTokens(Number(b.tokens))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/15 text-[11px] py-2">No builders yet. Be first.</p>
              )}
            </div>
          </div>

          {/* Signup form */}
          <div style={{ width: "320px" }} data-signup-form>
            <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: "rgba(5,5,16,0.85)", backdropFilter: "blur(12px)" }}>
              {!currentUser && !restoringSession && (
                <h2 className="text-[14px] font-bold tracking-tight mb-3">
                  Get on the board
                </h2>
              )}
              {restoringSession ? (
                <div className="flex items-center justify-center py-6">
                  <span className="inline-block w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  <span className="text-white/30 text-[12px] ml-2">Loading your profile...</span>
                </div>
              ) : (
                <SignupForm
                  currentUser={currentUser}
                  onSuccess={(result) => {
                    refreshLeaderboard();
                    if (result) {
                      const user = {
                        name: result.githubUsername || result.email.split("@")[0],
                        email: result.email,
                        city: result.city,
                        tokens: result.totalTokens,
                        verified: result.verified,
                        paid: result.paid,
                        claimCode: result.claimCode,
                        position: result.position,
                        cityPosition: result.cityPosition,
                        cityCount: result.cityCount,
                      };
                      setCurrentUser(user);
                      localStorage.setItem("tokenmap_user", JSON.stringify(user));
                    }
                  }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── How it works modal ── */}
      {showHowItWorks && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 2000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowHowItWorks(false)}
        >
          <div
            className="rounded-2xl border border-white/[0.1] p-6 max-w-sm w-full"
            style={{ background: "rgba(5,5,16,0.95)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold">How it works</h3>
              <button onClick={() => setShowHowItWorks(false)} className="text-white/20 hover:text-white/50 transition text-[18px]">×</button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="text-orange-400/70 text-[12px] font-bold mt-0.5">01</span>
                <div>
                  <p className="text-[13px] font-semibold">Sign up</p>
                  <p className="text-white/30 text-[11px] mt-0.5">Pick a username, drop your city. Takes 10 seconds.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-orange-400/70 text-[12px] font-bold mt-0.5">02</span>
                <div>
                  <p className="text-[13px] font-semibold">Scan your Claude Code</p>
                  <p className="text-white/30 text-[11px] mt-0.5">We read ~/.claude locally. Nothing leaves your machine except the total.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-orange-400/70 text-[12px] font-bold mt-0.5">03</span>
                <div>
                  <p className="text-[13px] font-semibold">Get your tile</p>
                  <p className="text-white/30 text-[11px] mt-0.5">More tokens = bigger dot on the map. Climb the leaderboard.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
