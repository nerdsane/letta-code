/**
 * search_trajectories - Search past agent experiences for relevant examples
 *
 * This tool enables context learning by retrieving similar past decisions.
 * Use it to:
 * - Find successful approaches to similar tasks
 * - Learn from past failures (anti-patterns)
 * - Recall how specific tools were used before
 *
 * Calls the Letta API's /v1/trajectories/search endpoint.
 */

import { getClient } from "../../agent/client";

// ============================================================================
// Types
// ============================================================================

export interface SearchTrajectoriesArgs {
  query: string;
  filters?: {
    domain?: string;
    entity_type?: string;
    entity_id?: string;
    action_type?: string;
    tags?: string[];
  };
  include_failures?: boolean;
  limit?: number;
}

export interface SearchTrajectoriesResult {
  toolReturn: string;
  status: "success" | "error";
  data?: {
    examples: FormattedExample[];
    anti_patterns: FormattedExample[];
    total_candidates: number;
  };
}

interface FormattedExample {
  similarity: number;
  outcome: string;
  action: string;
  context?: string;
  reasoning?: string;
  result?: string;
  error?: string;
  lesson?: string;
}

interface TrajectorySearchResult {
  trajectory: {
    id: string;
    searchable_summary?: string;
    outcome_score?: number;
    data?: {
      turns?: Array<{
        decisions?: Array<{
          choice?: {
            action?: string;
            rationale?: string;
            arguments?: Record<string, unknown>;
          };
          consequence?: {
            success?: boolean;
            result_summary?: string;
            error_type?: string;
          };
          evaluation?: {
            feedback?: string;
          };
          state?: {
            context_summary?: string;
          };
        }>;
      }>;
      metadata?: {
        domain?: string;
        tags?: string[];
      };
    };
  };
  similarity: number;
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function search_trajectories(
  args: SearchTrajectoriesArgs,
): Promise<SearchTrajectoriesResult> {
  try {
    console.error(
      "search_trajectories called with args:",
      JSON.stringify(args, null, 2),
    );

    if (!args || typeof args !== "object") {
      return {
        toolReturn: `Invalid arguments: expected object, got ${typeof args}`,
        status: "error",
      };
    }

    if (!args.query) {
      return {
        toolReturn: `Missing required parameter: query`,
        status: "error",
      };
    }

    const client = await getClient();
    const filters = args.filters || {};
    const limit = args.limit || 5;
    const includeFailures = args.include_failures ?? false;

    // Build query with filter context
    const queryParts = [args.query];
    if (filters.domain) {
      queryParts.push(`domain: ${filters.domain}`);
    }
    if (filters.entity_type) {
      queryParts.push(`entity: ${filters.entity_type}`);
    }
    if (filters.action_type) {
      queryParts.push(`action: ${filters.action_type}`);
    }
    const searchQuery = queryParts.join(" | ");

    // Search for successful trajectories
    const successResponse = await client.request({
      method: "post",
      path: "/v1/trajectories/search",
      body: {
        query: searchQuery,
        min_score: 0.7,
        domain_type: filters.domain,
        limit: limit * 3, // Get more to filter
      },
    }) as { results: TrajectorySearchResult[] };

    const successExamples = extractExamples(
      successResponse.results || [],
      filters,
      false, // not failures
      0.7,
      limit,
    );

    // Search for failures if requested
    let antiPatterns: FormattedExample[] = [];
    let failureCount = 0;
    if (includeFailures) {
      const failureResponse = await client.request({
        method: "post",
        path: "/v1/trajectories/search",
        body: {
          query: searchQuery,
          max_score: 0.5,
          domain_type: filters.domain,
          limit: limit * 3,
        },
      }) as { results: TrajectorySearchResult[] };

      failureCount = failureResponse.results?.length || 0;
      antiPatterns = extractExamples(
        failureResponse.results || [],
        filters,
        true, // failures
        0.0,
        limit,
      );
    }

    // Format combined output
    const formattedOutput = formatCombinedContext(successExamples, antiPatterns);

    return {
      toolReturn: formattedOutput,
      status: "success",
      data: {
        examples: successExamples,
        anti_patterns: antiPatterns,
        total_candidates: (successResponse.results?.length || 0) + failureCount,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("search_trajectories error:", message);
    return {
      toolReturn: `Error searching trajectories: ${message}`,
      status: "error",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractExamples(
  results: TrajectorySearchResult[],
  filters: SearchTrajectoriesArgs["filters"],
  isFailure: boolean,
  minScore: number,
  limit: number,
): FormattedExample[] {
  const examples: FormattedExample[] = [];
  const actionType = filters?.action_type;
  const entityType = filters?.entity_type;
  const entityId = filters?.entity_id;

  for (const result of results) {
    const trajectory = result.trajectory;
    const outcomeScore = trajectory.outcome_score;

    // Filter by outcome score
    if (isFailure) {
      if (outcomeScore !== undefined && outcomeScore >= 0.5) continue;
    } else {
      if (outcomeScore !== undefined && outcomeScore < minScore) continue;
    }

    // Extract decisions from trajectory
    const turns = trajectory.data?.turns || [];
    for (const turn of turns) {
      const decisions = turn.decisions || [];
      for (const decision of decisions) {
        // Filter by action type
        if (actionType && decision.choice?.action !== actionType) continue;

        // Filter by entity type/id
        if (entityType || entityId) {
          if (!matchesEntityFilter(decision, entityType, entityId)) continue;
        }

        // Skip successful decisions for failure examples
        if (isFailure && decision.consequence?.success) continue;

        // Skip failed decisions for success examples
        if (!isFailure && !decision.consequence?.success) continue;

        examples.push({
          similarity: result.similarity,
          outcome: isFailure ? "Failed" : "Success",
          action: decision.choice?.action || "unknown",
          context: decision.state?.context_summary,
          reasoning: decision.choice?.rationale,
          result: decision.consequence?.result_summary?.slice(0, 200),
          error: isFailure ? decision.consequence?.error_type : undefined,
          lesson: isFailure ? decision.evaluation?.feedback?.slice(0, 200) : undefined,
        });
      }
    }
  }

  // Sort by similarity and limit
  examples.sort((a, b) => b.similarity - a.similarity);
  return examples.slice(0, limit);
}

interface DecisionType {
  choice?: {
    action?: string;
    rationale?: string;
    arguments?: Record<string, unknown>;
  };
  consequence?: {
    success?: boolean;
    result_summary?: string;
    error_type?: string;
  };
  evaluation?: {
    feedback?: string;
  };
  state?: {
    context_summary?: string;
  };
}

function matchesEntityFilter(
  decision: DecisionType,
  entityType?: string,
  entityId?: string,
): boolean {
  const args = decision?.choice?.arguments;
  if (!args) return !entityType && !entityId;

  if (entityType) {
    if (args.type === entityType) return true;
    if (args.entity_type === entityType) return true;
  }
  if (entityId) {
    if (args.id === entityId) return true;
    if (args.entity_id === entityId) return true;
    if (entityType && args[`${entityType}_id`] === entityId) return true;
  }

  return !entityType && !entityId;
}

function formatCombinedContext(
  successExamples: FormattedExample[],
  antiPatterns: FormattedExample[],
): string {
  const sections: string[] = [];

  // Success examples section
  if (successExamples.length > 0) {
    const lines = [
      "## Relevant Past Decisions",
      "",
      "Consider these successful past approaches:",
      "",
    ];

    for (const ex of successExamples) {
      if (!ex) continue;
      lines.push(
        `### Example (similarity: ${ex.similarity.toFixed(2)}, outcome: ✓ Success)`,
      );
      lines.push(`**Action**: ${ex.action}`);
      if (ex.context) lines.push(`**Context**: ${ex.context}`);
      if (ex.reasoning) lines.push(`**Reasoning**: ${ex.reasoning}`);
      if (ex.result) lines.push(`**Result**: ${ex.result}`);
      lines.push("");
    }

    sections.push(lines.join("\n"));
  }

  // Anti-patterns section
  if (antiPatterns.length > 0) {
    const lines = [
      "## Anti-Patterns to Avoid",
      "",
      "The following approaches led to poor outcomes:",
      "",
    ];

    for (const ex of antiPatterns) {
      if (!ex) continue;
      lines.push(
        `### Example (similarity: ${ex.similarity.toFixed(2)}, outcome: ✗ Failed)`,
      );
      lines.push(`**Action**: ${ex.action}`);
      if (ex.context) lines.push(`**Context**: ${ex.context}`);
      if (ex.reasoning) lines.push(`**Reasoning**: ${ex.reasoning}`);
      if (ex.result) lines.push(`**Result**: ${ex.result}`);
      if (ex.error) lines.push(`**Error**: ${ex.error}`);
      if (ex.lesson) lines.push(`**Lesson**: ${ex.lesson}`);
      lines.push("");
    }

    sections.push(lines.join("\n"));
  }

  if (sections.length === 0) {
    return "No relevant past experiences found for this query.";
  }

  return sections.join("\n");
}
