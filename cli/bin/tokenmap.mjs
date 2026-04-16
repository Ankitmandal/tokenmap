#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

// ── Config ──
const API_BASE = process.env.TOKENMAP_API || "https://tokenmap.dev";

// ── Colors ──
const orange = (s) => `\x1b[38;5;208m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

// ── Entry ──
const token = process.argv[2];

if (!token || token === "--help" || token === "-h") {
  console.log("");
  console.log(bold("  tokenmap") + dim(" — claim your tile on the map"));
  console.log("");
  console.log("  Usage:");
  console.log(`    ${dim("$")} npx tokenmap ${orange("<your-claim-token>")}`);
  console.log("");
  console.log(dim("  Get your token at https://tokenmap.dev"));
  console.log("");
  process.exit(0);
}

console.log("");
console.log(`  ${orange("■")} ${bold("TokenMap")}`);
console.log("");

// ── Step 1: Find ~/.claude ──
const claudeDir = join(homedir(), ".claude", "projects");

if (!existsSync(claudeDir)) {
  console.log(red("  ✗ No Claude Code data found"));
  console.log(dim(`  Expected: ${claudeDir}`));
  console.log(dim("  Are you a Claude Code user?"));
  console.log("");
  process.exit(1);
}

console.log(dim("  Scanning ~/.claude ..."));
console.log("");

// ── Step 2: Scan all JSONL files ──
async function findJsonlFiles(dir) {
  const results = [];
  async function walk(d) {
    try {
      const entries = await readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name.endsWith(".jsonl")) results.push(full);
      }
    } catch {}
  }
  await walk(dir);
  return results;
}

const files = await findJsonlFiles(claudeDir);

if (files.length === 0) {
  console.log(red("  ✗ No conversation files found"));
  console.log(dim(`  Looked in: ${claudeDir}`));
  console.log("");
  process.exit(1);
}

let inputTokens = 0;
let outputTokens = 0;
let cacheCreation = 0;
let cacheRead = 0;
let messages = 0;
const sessions = new Set();
const models = {};
const projects = {};
const tools = {};
const dailyTokens = {};
let firstDate = null;
let lastDate = null;
let currentSession = null;
let currentSessionTokens = 0;
let longestSessionTokens = 0;

for (const filePath of files) {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const d = JSON.parse(line);

        if (d.type === "assistant" && d.message?.usage) {
          const u = d.message.usage;
          messages++;

          const inp = u.input_tokens || 0;
          const out = u.output_tokens || 0;
          const cc = u.cache_creation_input_tokens || 0;
          const cr = u.cache_read_input_tokens || 0;
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
            sessions.add(sid);
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
          if (d.timestamp) {
            try {
              const dt = new Date(d.timestamp);
              const day = dt.toISOString().split("T")[0];
              dailyTokens[day] = (dailyTokens[day] || 0) + total;
              if (!firstDate || dt < firstDate) firstDate = dt;
              if (!lastDate || dt > lastDate) lastDate = dt;
            } catch {}
          }

          // Tools
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

function fmt(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function prettifyModel(m) {
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  return m;
}

// Sort
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

const sortedDays = Object.entries(dailyTokens).sort((a, b) => b[1] - a[1]);
const peakDay = sortedDays[0] || ["N/A", 0];

const activeDays = Object.keys(dailyTokens).length;
const daySpan = firstDate && lastDate
  ? Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  : 0;

// ── Step 3: Display stats ──
console.log(`  ${orange(bold(fmt(totalTokens)))} tokens burned`);
console.log("");
console.log(`  ${dim("Input")}     ${fmt(inputTokens).padStart(8)}    ${dim("Output")}    ${fmt(outputTokens).padStart(8)}`);
console.log(`  ${dim("Cache ↑")}   ${fmt(cacheCreation).padStart(8)}    ${dim("Cache ↓")}   ${fmt(cacheRead).padStart(8)}`);
console.log("");
console.log(`  ${dim("Sessions")}  ${String(sessions.size).padStart(8)}    ${dim("Messages")}  ${String(messages).padStart(8)}`);
console.log(`  ${dim("Active")}    ${String(activeDays).padStart(7)}d    ${dim("Span")}      ${String(daySpan).padStart(7)}d`);
console.log("");

if (sortedModels.length > 0) {
  console.log(`  ${dim("Top model")}  ${sortedModels[0].name} ${dim(`(${Math.round((sortedModels[0].count / messages) * 100)}%)`)}`);
}
if (sortedProjects.length > 0) {
  console.log(`  ${dim("Top project")} ${sortedProjects[0].name} ${dim(`(${fmt(sortedProjects[0].count)} msgs)`)}`);
}
console.log("");

// ── Step 4: Send to API ──
console.log(dim("  Sending to TokenMap..."));

const stats = {
  totalTokens,
  totalFormatted: fmt(totalTokens),
  inputTokens,
  outputTokens,
  cacheCreation,
  cacheRead,
  filesScanned: files.length,
  messagesFound: messages,
  sessions: sessions.size,
  activeDays,
  daySpan,
  activeSince: firstDate ? firstDate.toISOString().split("T")[0] : "N/A",
  lastActive: lastDate ? lastDate.toISOString().split("T")[0] : "N/A",
  topModel: sortedModels[0]?.name || "N/A",
  topModelCount: sortedModels[0]?.count || 0,
  models: sortedModels,
  topProject: sortedProjects[0]?.name || "N/A",
  topProjectCount: sortedProjects[0]?.count || 0,
  projects: sortedProjects,
  topTools: sortedTools,
  totalToolCalls,
  peakDay: peakDay[0],
  peakDayTokens: peakDay[1],
  peakDayFormatted: fmt(peakDay[1]),
  longestSessionTokens,
  longestSessionFormatted: fmt(longestSessionTokens),
};

try {
  const res = await fetch(`${API_BASE}/api/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, stats }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.log("");
    console.log(red(`  ✗ ${data.error || "Failed to claim"}`));
    console.log(dim("  Make sure your claim token is valid."));
    console.log(dim("  Get one at https://tokenmap.dev"));
    console.log("");
    process.exit(1);
  }

  console.log("");
  console.log(`  ${green("✓")} ${bold("Claimed!")} Your tile is live on the map.`);
  if (data.rank) {
    console.log(`  ${orange(`#${data.rank}`)} on the leaderboard`);
  }
  console.log("");
  console.log(dim(`  → ${API_BASE}`));
  console.log("");
} catch (err) {
  console.log("");
  console.log(red(`  ✗ Network error: ${err.message}`));
  console.log(dim(`  Could not reach ${API_BASE}`));
  console.log("");
  process.exit(1);
}
