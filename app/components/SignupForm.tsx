import { useState, useEffect } from "react";

interface SignupResult {
  success: boolean;
  alreadyExists: boolean;
  position: number;
  email: string;
  githubUsername: string;
  city: string;
  cityPosition: number;
  cityCount: number;
  totalCount?: number;
  claimCode: string;
  referralCode: string;
  verified: boolean;
  paid: boolean;
  totalTokens: string;
}

export function SignupForm({
  onSuccess,
  currentUser,
}: {
  onSuccess?: (result: SignupResult) => void;
  currentUser?: { name: string; email: string; city: string; tokens: string; verified: boolean; paid: boolean; claimCode: string; position: number; cityPosition: number; cityCount: number } | null;
}) {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [github, setGithub] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SignupResult | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Auto-restore session from currentUser (localStorage)
  useEffect(() => {
    if (currentUser && !result) {
      setResult({
        success: true,
        alreadyExists: true,
        position: currentUser.position,
        email: currentUser.email,
        githubUsername: currentUser.name,
        city: currentUser.city,
        cityPosition: currentUser.cityPosition,
        cityCount: currentUser.cityCount,
        claimCode: currentUser.claimCode,
        referralCode: "",
        verified: currentUser.verified,
        paid: currentUser.paid,
        totalTokens: currentUser.tokens,
      });
    }
  }, [currentUser]);

  // Auto-detect location + city
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lng: longitude });
          // Reverse geocode to get city
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await res.json();
            const detectedCity = data.city || data.locality || data.principalSubdivision || "";
            if (detectedCity && !city) {
              setCity(detectedCity);
            }
          } catch {}
        },
        () => {}
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          city,
          githubUsername: github,
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setResult(data);
      onSuccess?.(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <PostSignup
        result={result}
        onTokensUpdated={(tokens, verified) => {
          const updated = { ...result, totalTokens: tokens, verified };
          setResult(updated);
          onSuccess?.(updated);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        required
        placeholder="Username (shown on leaderboard)"
        value={github}
        onChange={(e) => setGithub(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition text-[13px]"
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition text-[13px]"
      />
      <input
        type="text"
        required
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition text-[13px]"
      />

      {error && <p className="text-red-400 text-[12px]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-[13px] transition shadow-lg shadow-orange-500/20"
      >
        {loading ? "hold on..." : "I want a tile"}
      </button>
    </form>
  );
}

// ── Post-signup: CLI command + polling ──
function PostSignup({
  result,
  onTokensUpdated,
}: {
  result: SignupResult;
  onTokensUpdated: (tokens: string, verified: boolean) => void;
}) {
  // Determine initial step based on user state
  const initialStep = (): "cli" | "stats" | "pay" | "done" | "manual" => {
    if (result.paid) return "done";                          // already paid → show position
    if (Number(result.totalTokens) > 0) return "pay";       // scanned but not paid → show payment
    return "cli";                                             // new user → show CLI command
  };
  const [step, setStep] = useState(initialStep);
  const [scanStats, setScanStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const claimToken = result.claimCode;
  const cliCommand = `npx tokenmap ${claimToken}`;

  // Poll for CLI claim
  useEffect(() => {
    if (step !== "cli" || !polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/claim-status?token=${claimToken}`);
        const data = await res.json();
        if (data.claimed && data.stats) {
          setScanStats(data.stats);
          setStep("stats");
          setPolling(false);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [step, polling, claimToken]);

  function handleCopy() {
    navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Stats card from CLI scan
  if (step === "stats" && scanStats) {
    return (
      <StatsCard
        stats={scanStats}
        onDone={() => {
          onTokensUpdated(String(scanStats.totalTokens), true);
          setStep("pay");
        }}
      />
    );
  }

  // Payment step
  if (step === "pay") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-3">
          <p className="text-orange-400 text-[28px] font-bold">{scanStats?.totalFormatted || formatTokens(Number(result.totalTokens))}</p>
          <p className="text-white/30 text-[12px]">tokens verified</p>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] space-y-3">
          <p className="text-[13px] font-semibold text-center">Go live on the map</p>
          <p className="text-white/30 text-[11px] text-center leading-relaxed">
            Your tile is ready. Pay once to make it permanent — visible on the map and leaderboard forever.
          </p>

          <button
            onClick={async () => {
              setPayLoading(true);
              setPayError("");
              try {
                const res = await fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: result.email }),
                });
                let data: any;
                try { data = await res.json(); } catch { data = {}; }
                if (data.checkoutUrl) {
                  window.location.href = data.checkoutUrl;
                } else if (data.alreadyPaid) {
                  setStep("done");
                } else {
                  setPayError(data.error || "Something went wrong. Try the production site.");
                  setPayLoading(false);
                }
              } catch {
                setPayError("Network error. Try again.");
                setPayLoading(false);
              }
            }}
            disabled={payLoading}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[14px] font-semibold transition shadow-lg shadow-orange-500/20"
          >
            {payLoading ? "Redirecting..." : "Claim my tile — $5"}
          </button>

          {payError && <p className="text-red-400 text-[11px] text-center">{payError}</p>}

          <p className="text-white/15 text-[10px] text-center">
            One-time payment. No subscription.
          </p>
        </div>
      </div>
    );
  }

  // Manual token entry fallback
  if (step === "manual") {
    return (
      <TokenEntry
        email={result.email}
        onDone={(tokens, verified) => {
          onTokensUpdated(tokens, verified);
          setStep("done");
        }}
        onCancel={() => setStep("cli")}
      />
    );
  }

  // CLI command step (primary flow)
  if (step === "cli") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/15 text-green-400 text-[13px] font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {result.alreadyExists ? "Welcome back" : "You're in"}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-center">
            Now claim your tokens
          </p>
          <p className="text-white/30 text-[11px] text-center">
            Run this in your terminal
          </p>

          {/* CLI command box */}
          <button
            onClick={handleCopy}
            className="w-full group relative"
          >
            <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-black/40 border border-white/[0.08] hover:border-orange-500/30 transition">
              <span className="text-orange-400/40 text-[11px] font-mono select-none">$</span>
              <code className="text-[12px] font-mono text-orange-400/80 flex-1 text-left truncate">
                {cliCommand}
              </code>
              <span className="text-[10px] text-white/20 group-hover:text-white/40 transition shrink-0">
                {copied ? "✓ copied" : "copy"}
              </span>
            </div>
          </button>

          <p className="text-white/15 text-[10px] text-center leading-relaxed">
            Scans ~/.claude locally. Only totals are sent.
          </p>
        </div>

        {/* Polling indicator */}
        <div className="flex items-center justify-center gap-2 text-white/20 text-[11px]">
          <span className="inline-block w-2 h-2 bg-orange-400/40 rounded-full animate-pulse" />
          Waiting for scan...
        </div>

        {/* Fallback */}
        <button
          onClick={() => setStep("manual")}
          className="w-full text-center text-white/15 text-[10px] hover:text-white/30 transition"
        >
          No terminal? Enter tokens manually →
        </button>
      </div>
    );
  }

  // Done state — position card + project management
  return (
    <DoneState result={result} claimCode={claimToken} />
  );
}

// ── Done state: position card + project showcase management ──
function DoneState({ result, claimCode }: { result: SignupResult; claimCode: string }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch(`/api/projects?code=${claimCode}`);
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
      } catch {}
      setLoadingProjects(false);
    }
    fetchProjects();
  }, [claimCode]);

  async function saveProjects() {
    setSaving(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimCode, projects }),
      });
    } catch {}
    setSaving(false);
  }

  function updateProject(index: number, field: string, value: string) {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  }

  const visibilityOptions = [
    { value: "public", label: "Public", color: "text-green-400" },
    { value: "building", label: "Building", color: "text-yellow-400" },
    { value: "hidden", label: "Hidden", color: "text-white/25" },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/15 text-green-400 text-[13px] font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          You're live on the map
        </div>

        <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
          <p className="text-3xl font-bold text-orange-400">#{result.position}</p>
          <p className="text-white/30 text-[12px] mt-1">on the board</p>
          <div className="h-px bg-white/[0.06] my-3" />
          <p className="text-[15px] font-semibold">
            #{result.cityPosition} in <span className="text-orange-400">{result.city}</span>
          </p>
          <p className="text-white/25 text-[11px] mt-1">
            {result.cityCount} builder{result.cityCount !== 1 ? "s" : ""} in {result.city}
          </p>
          {Number(result.totalTokens) > 0 && (
            <>
              <div className="h-px bg-white/[0.06] my-3" />
              <p className="text-orange-400 text-[18px] font-bold">{formatTokens(Number(result.totalTokens))}</p>
              <p className="text-white/25 text-[11px]">tokens burned</p>
            </>
          )}
        </div>
      </div>

      {/* Profile link */}
      {result.githubUsername && (
        <div className="text-center">
          <a
            href={`/u/${result.githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-orange-400/60 hover:text-orange-400 text-[11px] transition"
          >
            Your public profile → /u/{result.githubUsername}
          </a>
        </div>
      )}

      {/* Project showcase toggle */}
      {projects.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowProjects(!showProjects)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.1] transition"
          >
            <span className="text-[12px] font-medium text-white/60">
              Manage projects ({projects.length})
            </span>
            <svg
              className={`w-3.5 h-3.5 text-white/25 transition-transform ${showProjects ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showProjects && (
            <div className="space-y-2">
              {loadingProjects ? (
                <p className="text-white/20 text-[11px] text-center py-3">Loading...</p>
              ) : (
                <>
                  {projects.map((p, i) => (
                    <div
                      key={p.name}
                      className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium truncate flex-1">{p.name}</span>
                        <span className="text-white/15 text-[10px] font-mono ml-2">
                          {formatTokens(p.messages)} msgs
                        </span>
                      </div>

                      {/* Visibility toggle */}
                      <div className="flex gap-1">
                        {visibilityOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateProject(i, "visibility", opt.value)}
                            className={`flex-1 py-1 rounded text-[10px] font-medium transition border ${
                              p.visibility === opt.value
                                ? `${opt.color} bg-white/[0.06] border-white/[0.1]`
                                : "text-white/20 border-transparent hover:text-white/40"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* URL input (only for public/building) */}
                      {p.visibility !== "hidden" && (
                        <input
                          type="url"
                          placeholder="Product URL (optional)"
                          value={p.url || ""}
                          onChange={(e) => updateProject(i, "url", e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-black/30 border border-white/[0.06] text-[11px] text-white/60 placeholder-white/15 focus:outline-none focus:border-orange-500/30 transition"
                        />
                      )}
                    </div>
                  ))}

                  <button
                    onClick={saveProjects}
                    disabled={saving}
                    className="w-full py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-[12px] font-medium transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save project settings"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Share */}
      <div className="text-center space-y-2">
        <button
          onClick={() => {
            const tokenPart = Number(result.totalTokens) > 0
              ? ` ${formatTokens(Number(result.totalTokens))} tokens burned.`
              : "";
            const text = encodeURIComponent(
              `I'm #${result.position} on TokenMap.${tokenPart}\n\n#${result.cityPosition} in ${result.city}. Claim your tile → tokenmap.dev`
            );
            window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 text-[12px] font-medium transition"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on Twitter
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("tokenmap_user");
            window.location.reload();
          }}
          className="text-white/10 text-[10px] hover:text-white/30 transition"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  );
}

// ── Token entry: manual first, API key as advanced ──
function TokenEntry({
  email,
  onDone,
  onCancel,
}: {
  email: string;
  onDone: (tokens: string, verified: boolean) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"manual" | "api">("manual");
  const [manualValue, setManualValue] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preset quick-pick values
  const presets = [
    { label: "~100K", value: 100_000 },
    { label: "~1M", value: 1_000_000 },
    { label: "~5M", value: 5_000_000 },
    { label: "~10M", value: 10_000_000 },
    { label: "~50M", value: 50_000_000 },
    { label: "100M+", value: 100_000_000 },
  ];

  async function submitManual() {
    const raw = manualValue.replace(/[^0-9]/g, "");
    const tokens = parseInt(raw);
    if (!tokens || tokens <= 0) {
      setError("Enter a number");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/verify-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "manual", email, tokens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      onDone(data.totalTokens, false);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function submitApiKey() {
    if (!apiKey.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/verify-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }
      onDone(data.totalTokens, true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">How many tokens?</h3>
        <button onClick={onCancel} className="text-white/20 hover:text-white/50 text-[11px]">
          skip
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
        <button
          onClick={() => { setMode("manual"); setError(""); }}
          className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition ${
            mode === "manual" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
          }`}
        >
          Quick pick
        </button>
        <button
          onClick={() => { setMode("api"); setError(""); }}
          className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition ${
            mode === "api" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
          }`}
        >
          Verify with API key
        </button>
      </div>

      {mode === "manual" && (
        <div className="space-y-3">
          {/* Quick-pick grid */}
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setManualValue(String(p.value))}
                className={`py-2 rounded-lg text-[12px] font-medium transition border ${
                  manualValue === String(p.value)
                    ? "bg-orange-500/20 border-orange-500/30 text-orange-400"
                    : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Or type exact */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="or type exact number"
              value={manualValue ? Number(manualValue).toLocaleString() : ""}
              onChange={(e) => setManualValue(e.target.value.replace(/[^0-9]/g, ""))}
              className="flex-1 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/30 transition text-[13px] font-mono"
            />
          </div>

          <p className="text-white/15 text-[10px]">
            Monthly token usage across all AI APIs (OpenAI, Anthropic, etc). Self-reported — you get a ◇ badge. Verify with API key for ✓.
          </p>
        </div>
      )}

      {mode === "api" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["openai", "anthropic"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition ${
                  provider === p
                    ? "bg-white/10 text-white border border-white/15"
                    : "bg-white/[0.03] text-white/30 border border-transparent hover:text-white/50"
                }`}
              >
                {p === "openai" ? "OpenAI" : "Anthropic"}
              </button>
            ))}
          </div>

          <input
            type="password"
            placeholder={provider === "openai" ? "sk-admin-..." : "sk-ant-admin-..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 transition text-[13px] font-mono"
          />
          <p className="text-white/15 text-[10px] leading-relaxed">
            Admin API key required for usage data. Used once, never stored. Get yours from{" "}
            {provider === "openai" ? "platform.openai.com/api-keys" : "console.anthropic.com/settings/keys"}.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-[12px]">{error}</p>}

      <button
        onClick={mode === "manual" ? submitManual : submitApiKey}
        disabled={loading || (mode === "manual" ? !manualValue : !apiKey.trim())}
        className="w-full py-2.5 rounded-lg bg-orange-500/80 hover:bg-orange-500 disabled:opacity-30 text-white text-[13px] font-medium transition"
      >
        {loading ? "Saving..." : mode === "manual" ? "Claim tile size" : "Verify & claim"}
      </button>
    </div>
  );
}

// ── Scan Claude Code + Stats Card ──
function ScanClaudeCode({
  email,
  onDone,
  onStatsReady,
}: {
  email: string;
  onDone: (tokens: string) => void;
  onStatsReady?: (stats: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<any>(null);

  async function handleScan() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/scan-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Scan failed"); return; }
      setStats(data.stats);
      onStatsReady?.(data.stats);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (stats) {
    return (
      <div className="space-y-3">
        <StatsCard stats={stats} onDone={() => onDone(String(stats.totalTokens))} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-[13px] font-medium transition border border-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            Scanning ~/.claude ...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            Scan my Claude Code usage
          </>
        )}
      </button>
      <p className="text-white/15 text-[10px] text-center">
        Reads ~/.claude locally. No API key needed. Nothing sent except the total.
      </p>
      {error && <p className="text-red-400 text-[11px] text-center">{error}</p>}
    </div>
  );
}

// ── The Stats Card (Spotify Wrapped for Claude Code) ──
function StatsCard({ stats, onDone }: { stats: any; onDone: () => void }) {
  const maxProjectMsgs = stats.projects[0]?.count || 1;
  const maxToolCalls = stats.topTools[0]?.count || 1;

  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-[8px] font-black">T</div>
            <span className="text-[11px] text-white/30 font-medium">Claude Code Wrapped</span>
          </div>
          <span className="text-[10px] text-white/15 font-mono">✓ verified</span>
        </div>
      </div>

      {/* Big number */}
      <div className="text-center py-5 px-5">
        <p className="text-[42px] font-bold text-orange-400 leading-none tracking-tight">
          {stats.totalFormatted}
        </p>
        <p className="text-white/25 text-[12px] mt-2">tokens burned</p>
      </div>

      {/* Token breakdown */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] mx-5 rounded-lg overflow-hidden mb-4">
        {[
          { label: "Input", value: stats.inputTokens },
          { label: "Output", value: stats.outputTokens },
          { label: "Cache ↑", value: stats.cacheCreation },
          { label: "Cache ↓", value: stats.cacheRead },
        ].map((item) => (
          <div key={item.label} className="bg-black/40 py-2 px-1 text-center">
            <p className="text-white/50 text-[11px] font-mono">{formatTokens(item.value)}</p>
            <p className="text-white/15 text-[9px] mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-3 gap-3 px-5 mb-4">
        <div className="text-center">
          <p className="text-white font-bold text-[18px]">{stats.sessions}</p>
          <p className="text-white/20 text-[10px]">sessions</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-[18px]">{stats.activeDays}</p>
          <p className="text-white/20 text-[10px]">active days</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-[18px]">{stats.messagesFound.toLocaleString()}</p>
          <p className="text-white/20 text-[10px]">messages</p>
        </div>
      </div>

      {/* Favorite model */}
      <div className="mx-5 mb-3 bg-white/[0.025] rounded-lg p-3">
        <p className="text-white/20 text-[10px] uppercase tracking-wider mb-2">Favorite model</p>
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold text-white">{stats.topModel}</span>
          <span className="text-white/20 text-[11px] font-mono">{((stats.topModelCount / stats.messagesFound) * 100).toFixed(0)}% of messages</span>
        </div>
        {stats.models.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {stats.models.map((m: any) => (
              <div
                key={m.name}
                className="h-1.5 rounded-full"
                style={{
                  width: `${(m.count / stats.messagesFound) * 100}%`,
                  minWidth: "8px",
                  background: m.name === "Opus" ? "rgba(249,115,22,0.8)"
                    : m.name === "Sonnet" ? "rgba(249,115,22,0.4)"
                    : "rgba(249,115,22,0.2)",
                }}
                title={`${m.name}: ${m.count.toLocaleString()}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Top projects */}
      <div className="mx-5 mb-3 bg-white/[0.025] rounded-lg p-3">
        <p className="text-white/20 text-[10px] uppercase tracking-wider mb-2">Top projects</p>
        <div className="space-y-1.5">
          {stats.projects.slice(0, 5).map((p: any, i: number) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="text-white/15 text-[10px] w-3 tabular-nums">{i + 1}</span>
              <span className="text-[12px] text-white/70 flex-1 truncate">{p.name}</span>
              <div className="w-20 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500/50"
                  style={{ width: `${(p.count / maxProjectMsgs) * 100}%` }}
                />
              </div>
              <span className="text-white/20 text-[10px] font-mono w-10 text-right">{formatTokens(p.count)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tools used */}
      <div className="mx-5 mb-3 bg-white/[0.025] rounded-lg p-3">
        <p className="text-white/20 text-[10px] uppercase tracking-wider mb-2">
          Tools called <span className="text-white/10">({stats.totalToolCalls.toLocaleString()} total)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {stats.topTools.map((t: any) => (
            <span
              key={t.name}
              className="px-2 py-0.5 rounded text-[10px] font-mono"
              style={{
                background: `rgba(249,115,22,${Math.max(0.05, (t.count / maxToolCalls) * 0.25)})`,
                color: `rgba(249,115,22,${Math.max(0.3, (t.count / maxToolCalls) * 0.9)})`,
              }}
            >
              {t.name} <span className="opacity-50">{formatTokens(t.count)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Peak stats */}
      <div className="grid grid-cols-2 gap-3 mx-5 mb-4">
        <div className="bg-white/[0.025] rounded-lg p-3 text-center">
          <p className="text-orange-400 font-bold text-[14px]">{stats.peakDayFormatted}</p>
          <p className="text-white/15 text-[9px] mt-0.5">peak day ({stats.peakDay})</p>
        </div>
        <div className="bg-white/[0.025] rounded-lg p-3 text-center">
          <p className="text-orange-400 font-bold text-[14px]">{stats.longestSessionFormatted}</p>
          <p className="text-white/15 text-[9px] mt-0.5">longest session</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 pb-4 text-center">
        <p className="text-white/15 text-[10px]">
          Active since <span className="text-white/30">{stats.activeSince}</span> · {stats.daySpan} days · {stats.filesScanned} conversations
        </p>
      </div>

      {/* Claim button */}
      <div className="px-5 pb-5">
        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition shadow-lg shadow-orange-500/20"
        >
          Claim my tile with {stats.totalFormatted} tokens
        </button>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
