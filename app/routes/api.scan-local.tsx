import type { Route } from "./+types/api.scan-local";
import { prisma } from "../db.server";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  const entry = await prisma.builder.findUnique({ where: { email } });
  if (!entry) {
    return Response.json({ error: "Email not found. Sign up first." }, { status: 404 });
  }

  const claudeDir = join(homedir(), ".claude", "projects");
  if (!existsSync(claudeDir)) {
    return Response.json(
      { error: "No Claude Code data found at ~/.claude. Are you a Claude Code user?" },
      { status: 404 }
    );
  }

  try {
    const stats = await scanClaudeUsage(claudeDir);

    await prisma.builder.update({
      where: { email },
      data: {
        totalTokens: BigInt(stats.totalTokens),
        provider: "claude-code",
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return Response.json({ success: true, stats });
  } catch (err: any) {
    console.error("Scan error:", err);
    return Response.json(
      { error: err.message || "Failed to scan Claude Code data" },
      { status: 500 }
    );
  }
}

interface ScanResult {
  // Tokens
  totalTokens: number;
  totalFormatted: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  // Activity
  filesScanned: number;
  messagesFound: number;
  sessions: number;
  activeDays: number;
  daySpan: number;
  activeSince: string;
  lastActive: string;
  // Favorites
  topModel: string;
  topModelCount: number;
  models: { name: string; count: number }[];
  topProject: string;
  topProjectCount: number;
  projects: { name: string; count: number }[];
  // Tools
  topTools: { name: string; count: number }[];
  totalToolCalls: number;
  // Peaks
  peakDay: string;
  peakDayTokens: number;
  peakDayFormatted: string;
  longestSessionTokens: number;
  longestSessionFormatted: string;
}

async function scanClaudeUsage(baseDir: string): Promise<ScanResult> {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreation = 0;
  let cacheRead = 0;
  let filesScanned = 0;
  let messagesFound = 0;

  const models: Record<string, number> = {};
  const projects: Record<string, number> = {};
  const tools: Record<string, number> = {};
  const dailyTokens: Record<string, number> = {};
  const sessionSet = new Set<string>();

  let firstMsg: Date | null = null;
  let lastMsg: Date | null = null;
  let currentSession: string | null = null;
  let currentSessionTokens = 0;
  let longestSessionTokens = 0;

  const jsonlFiles = await findJsonlFiles(baseDir);

  for (const filePath of jsonlFiles) {
    filesScanned++;
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const d = JSON.parse(line);

          if (d.type === "assistant" && d.message?.usage) {
            const usage = d.message.usage;
            messagesFound++;

            const inp = usage.input_tokens || 0;
            const out = usage.output_tokens || 0;
            const cc = usage.cache_creation_input_tokens || 0;
            const cr = usage.cache_read_input_tokens || 0;
            const total = inp + out + cc + cr;

            inputTokens += inp;
            outputTokens += out;
            cacheCreation += cc;
            cacheRead += cr;

            // Model
            const model = d.message?.model || "unknown";
            if (model !== "<synthetic>") {
              models[model] = (models[model] || 0) + 1;
            }

            // Project
            const cwd = d.cwd || "";
            if (cwd) {
              const proj = cwd.split("/").pop() || cwd;
              projects[proj] = (projects[proj] || 0) + 1;
            }

            // Session
            const sid = d.sessionId || "";
            if (sid) {
              sessionSet.add(sid);
              if (sid !== currentSession) {
                if (currentSessionTokens > longestSessionTokens) {
                  longestSessionTokens = currentSessionTokens;
                }
                currentSession = sid;
                currentSessionTokens = 0;
              }
              currentSessionTokens += total;
            }

            // Timestamp
            const ts = d.timestamp;
            if (ts) {
              try {
                const dt = new Date(ts);
                const day = dt.toISOString().split("T")[0];
                dailyTokens[day] = (dailyTokens[day] || 0) + total;
                if (!firstMsg || dt < firstMsg) firstMsg = dt;
                if (!lastMsg || dt > lastMsg) lastMsg = dt;
              } catch {}
            }

            // Tools used
            const content = d.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block?.type === "tool_use" && block.name) {
                  tools[block.name] = (tools[block.name] || 0) + 1;
                }
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Check last session
  if (currentSessionTokens > longestSessionTokens) {
    longestSessionTokens = currentSessionTokens;
  }

  const totalTokens = inputTokens + outputTokens + cacheCreation + cacheRead;

  // Sort and pick tops
  const sortedModels = Object.entries(models)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name: prettifyModel(name), count }));

  const sortedProjects = Object.entries(projects)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const sortedTools = Object.entries(tools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const totalToolCalls = Object.values(tools).reduce((a, b) => a + b, 0);

  // Peak day
  const sortedDays = Object.entries(dailyTokens).sort((a, b) => b[1] - a[1]);
  const peakDay = sortedDays[0] || ["N/A", 0];

  const daySpan = firstMsg && lastMsg
    ? Math.ceil((lastMsg.getTime() - firstMsg.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    totalTokens,
    totalFormatted: fmt(totalTokens),
    inputTokens,
    outputTokens,
    cacheCreation,
    cacheRead,
    filesScanned,
    messagesFound,
    sessions: sessionSet.size,
    activeDays: Object.keys(dailyTokens).length,
    daySpan,
    activeSince: firstMsg ? firstMsg.toISOString().split("T")[0] : "N/A",
    lastActive: lastMsg ? lastMsg.toISOString().split("T")[0] : "N/A",
    topModel: sortedModels[0]?.name || "N/A",
    topModelCount: sortedModels[0]?.count || 0,
    models: sortedModels,
    topProject: sortedProjects[0]?.name || "N/A",
    topProjectCount: sortedProjects[0]?.count || 0,
    projects: sortedProjects,
    topTools: sortedTools,
    totalToolCalls,
    peakDay: peakDay[0],
    peakDayTokens: peakDay[1] as number,
    peakDayFormatted: fmt(peakDay[1] as number),
    longestSessionTokens,
    longestSessionFormatted: fmt(longestSessionTokens),
  };
}

async function findJsonlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) await walk(fullPath);
        else if (entry.name.endsWith(".jsonl")) results.push(fullPath);
      }
    } catch {}
  }
  await walk(dir);
  return results;
}

function prettifyModel(m: string): string {
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  return m;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
