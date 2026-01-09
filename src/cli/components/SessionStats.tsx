import type { SessionStatsSnapshot } from "../../agent/stats";
import { formatCompact } from "../helpers/format";

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface BalanceInfo {
  total_balance: number;
  monthly_credit_balance: number;
  purchased_credit_balance: number;
  billing_tier: string;
}

interface FormatUsageStatsOptions {
  stats: SessionStatsSnapshot;
  balance?: BalanceInfo;
}

/**
 * Format usage statistics as markdown text for display in CommandMessage
 */
export function formatUsageStats({
  stats,
  balance,
}: FormatUsageStatsOptions): string {
  const outputLines = [
    `Total duration (API):  ${formatDuration(stats.totalApiMs)}`,
    `Total duration (wall): ${formatDuration(stats.totalWallMs)}`,
    `Session usage:         ${stats.usage.stepCount} steps, ${formatCompact(stats.usage.promptTokens)} input, ${formatCompact(stats.usage.completionTokens)} output`,
  ];

  // Add cost information if available
  if (
    stats.usage.totalCost !== undefined &&
    stats.usage.totalCost !== null &&
    stats.usage.totalCost > 0
  ) {
    const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

    let costLine = `Session cost:          ${formatCost(stats.usage.totalCost)}`;

    // Add breakdown if available
    const costParts: string[] = [];
    if (stats.usage.inputCost && stats.usage.inputCost > 0) {
      costParts.push(`${formatCost(stats.usage.inputCost)} input`);
    }
    if (stats.usage.outputCost && stats.usage.outputCost > 0) {
      costParts.push(`${formatCost(stats.usage.outputCost)} output`);
    }
    if (stats.usage.cachedInputCost && stats.usage.cachedInputCost > 0) {
      costParts.push(`${formatCost(stats.usage.cachedInputCost)} cached`);
    }
    if (stats.usage.reasoningCost && stats.usage.reasoningCost > 0) {
      costParts.push(`${formatCost(stats.usage.reasoningCost)} reasoning`);
    }

    if (costParts.length > 0) {
      costLine += ` (${costParts.join(", ")})`;
    }

    outputLines.push(costLine);
  }

  outputLines.push("");

  if (balance) {
    // API returns credits (integers), dollars = credits / 1000
    const totalCredits = Math.round(balance.total_balance);
    const monthlyCredits = Math.round(balance.monthly_credit_balance);
    const purchasedCredits = Math.round(balance.purchased_credit_balance);

    const toDollars = (credits: number) => (credits / 1000).toFixed(2);

    outputLines.push(
      `Available credits:     ◎${formatNumber(totalCredits)} ($${toDollars(totalCredits)})       Plan: [${balance.billing_tier}]`,
      `  Monthly credits:     ◎${formatNumber(monthlyCredits)} ($${toDollars(monthlyCredits)})`,
      `  Purchased credits:   ◎${formatNumber(purchasedCredits)} ($${toDollars(purchasedCredits)})`,
      "",
      "https://app.letta.com/settings/organization/usage",
    );
  }

  return outputLines.join("\n");
}
