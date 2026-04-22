// Badge system — earned achievements based on CLI scan stats
export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const ALL_BADGES: Record<string, Badge> = {
  marathoner:     { id: "marathoner",     emoji: "🏃",  name: "Marathoner",     description: "single session over 10M tokens" },
  opus_purist:    { id: "opus_purist",    emoji: "🎭",  name: "Opus Purist",    description: "80%+ Opus usage" },
  sonnet_main:    { id: "sonnet_main",    emoji: "⚡",  name: "Sonnet Main",    description: "80%+ Sonnet usage" },
  tool_addict:    { id: "tool_addict",    emoji: "🛠️",  name: "Tool Addict",    description: "over 1000 tool calls" },
  edit_wizard:    { id: "edit_wizard",    emoji: "✏️",  name: "Edit Wizard",    description: "Edit is your top tool" },
  bash_gremlin:   { id: "bash_gremlin",   emoji: "💻",  name: "Bash Gremlin",   description: "Bash is your top tool" },
  read_monk:      { id: "read_monk",      emoji: "📖",  name: "Read Monk",      description: "Read is your top tool" },
  consistent:     { id: "consistent",     emoji: "🌊",  name: "Consistent",     description: "30+ active days" },
  focused:        { id: "focused",        emoji: "🎯",  name: "Focused",        description: "one project = 50%+ of work" },
  hopper:         { id: "hopper",         emoji: "🦘",  name: "Project Hopper", description: "10+ distinct projects" },
  peak_day:       { id: "peak_day",       emoji: "🔥",  name: "Peak Day",       description: "best single day over 100M" },
  agent_caller:   { id: "agent_caller",   emoji: "🤖",  name: "Agent Caller",   description: "heavy Task/Agent tool usage" },
  webhunter:      { id: "webhunter",      emoji: "🕸️",  name: "Webhunter",      description: "heavy WebFetch/WebSearch" },
};

export interface StatsForBadges {
  totalTokens: number;
  messagesFound: number;
  activeDays: number;
  totalToolCalls: number;
  longestSessionTokens: number;
  peakDayTokens: number;
  models: { name: string; count: number }[];
  projects: { name: string; count: number }[];
  topTools: { name: string; count: number }[];
}

export function computeBadges(stats: StatsForBadges): Badge[] {
  const earned: Badge[] = [];

  // Marathoner
  if (stats.longestSessionTokens > 10_000_000) earned.push(ALL_BADGES.marathoner);

  // Model purity
  const totalModelMsgs = stats.models.reduce((s, m) => s + m.count, 0);
  if (totalModelMsgs > 0) {
    const opus = stats.models.find((m) => m.name === "Opus")?.count || 0;
    const sonnet = stats.models.find((m) => m.name === "Sonnet")?.count || 0;
    if (opus / totalModelMsgs >= 0.8) earned.push(ALL_BADGES.opus_purist);
    else if (sonnet / totalModelMsgs >= 0.8) earned.push(ALL_BADGES.sonnet_main);
  }

  // Tool addict
  if (stats.totalToolCalls > 1000) earned.push(ALL_BADGES.tool_addict);

  // Top tool
  const topTool = stats.topTools[0]?.name || "";
  if (topTool === "Edit") earned.push(ALL_BADGES.edit_wizard);
  else if (topTool === "Bash") earned.push(ALL_BADGES.bash_gremlin);
  else if (topTool === "Read") earned.push(ALL_BADGES.read_monk);

  // Heavy Task/Agent
  const taskCount = stats.topTools.find((t) => t.name === "Task" || t.name === "Agent")?.count || 0;
  if (taskCount > 100) earned.push(ALL_BADGES.agent_caller);

  // Web
  const webCount = stats.topTools.filter((t) => t.name === "WebFetch" || t.name === "WebSearch").reduce((s, t) => s + t.count, 0);
  if (webCount > 200) earned.push(ALL_BADGES.webhunter);

  // Consistency
  if (stats.activeDays >= 30) earned.push(ALL_BADGES.consistent);

  // Focused vs Hopper
  const totalProjMsgs = stats.projects.reduce((s, p) => s + p.count, 0);
  const topProj = stats.projects[0]?.count || 0;
  if (totalProjMsgs > 0 && topProj / totalProjMsgs >= 0.5) earned.push(ALL_BADGES.focused);
  if (stats.projects.length >= 10) earned.push(ALL_BADGES.hopper);

  // Peak day
  if (stats.peakDayTokens > 100_000_000) earned.push(ALL_BADGES.peak_day);

  return earned;
}
