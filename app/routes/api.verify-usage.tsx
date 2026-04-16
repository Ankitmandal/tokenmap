import type { Route } from "./+types/api.verify-usage";
import { prisma } from "../db.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { provider, apiKey, email, tokens: manualTokens } = body as {
    provider?: string;
    apiKey?: string;
    email?: string;
    tokens?: number;
  };

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const entry = await prisma.builder.findUnique({ where: { email } });
  if (!entry) {
    return Response.json({ error: "Email not found. Sign up first." }, { status: 404 });
  }

  // ── Manual entry ──
  if (provider === "manual" && manualTokens) {
    const clamped = Math.min(Math.max(0, manualTokens), 10_000_000_000); // cap at 10B
    await prisma.builder.update({
      where: { email },
      data: {
        totalTokens: BigInt(clamped),
        provider: "self-reported",
        verified: false, // manual = unverified badge
        verifiedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      provider: "self-reported",
      tokensFound: clamped,
      totalTokens: String(clamped),
      verified: false,
      message: `Logged ${formatTokens(clamped)} tokens (self-reported)`,
    });
  }

  // ── API verification ──
  if (!provider || !apiKey) {
    return Response.json(
      { error: "provider and apiKey are required for API verification" },
      { status: 400 }
    );
  }

  if (!["openai", "anthropic"].includes(provider)) {
    return Response.json(
      { error: "Provider must be 'openai' or 'anthropic'" },
      { status: 400 }
    );
  }

  try {
    let totalTokens = 0;

    if (provider === "openai") {
      totalTokens = await fetchOpenAIUsage(apiKey);
    } else if (provider === "anthropic") {
      totalTokens = await fetchAnthropicUsage(apiKey);
    }

    const newTotal = BigInt(entry.totalTokens) + BigInt(totalTokens);

    await prisma.builder.update({
      where: { email },
      data: {
        totalTokens: newTotal,
        provider: entry.provider
          ? entry.provider === provider ? provider : "both"
          : provider,
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      provider,
      tokensFound: totalTokens,
      totalTokens: newTotal.toString(),
      verified: true,
      message: `Verified ${formatTokens(totalTokens)} tokens from ${provider}`,
    });
  } catch (err: any) {
    console.error(`Verification error (${provider}):`, err);

    if (err.status === 401 || err.message?.includes("401")) {
      return Response.json(
        { error: "Invalid API key. Check your key and try again." },
        { status: 401 }
      );
    }
    if (err.status === 403 || err.message?.includes("403")) {
      return Response.json(
        { error: "API key doesn't have usage/billing permissions. Try the manual entry instead." },
        { status: 403 }
      );
    }

    return Response.json(
      { error: err.message || "Failed to verify usage. Try manual entry instead." },
      { status: 500 }
    );
  }
}

// ── OpenAI Usage API ──
async function fetchOpenAIUsage(apiKey: string): Promise<number> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const res = await fetch(
    `https://api.openai.com/v1/organization/usage/completions?start_time=${Math.floor(thirtyDaysAgo.getTime() / 1000)}&end_time=${Math.floor(now.getTime() / 1000)}&bucket_width=1d`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw { status: res.status, message: `OpenAI API error: ${res.status}` };
  }

  const data = await res.json();
  let totalTokens = 0;
  if (data.data) {
    for (const bucket of data.data) {
      if (bucket.results) {
        for (const result of bucket.results) {
          totalTokens += (result.input_tokens || 0) + (result.output_tokens || 0);
        }
      }
    }
  }
  return totalTokens;
}

// ── Anthropic Usage API ──
async function fetchAnthropicUsage(apiKey: string): Promise<number> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = thirtyDaysAgo.toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];

  const res = await fetch(
    `https://api.anthropic.com/v1/organizations/usage?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    }
  );

  if (!res.ok) {
    throw {
      status: res.status,
      message: "Anthropic usage API requires an admin API key.",
    };
  }

  const data = await res.json();
  let totalTokens = 0;
  if (data.data) {
    for (const entry of data.data) {
      totalTokens += (entry.input_tokens || 0) + (entry.output_tokens || 0);
    }
  }
  return totalTokens;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
