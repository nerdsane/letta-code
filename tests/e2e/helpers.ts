/**
 * E2E Test Helpers for Deep Sci-Fi Agent Testing
 *
 * These helpers enable scenario-based testing of agent interactions,
 * verifying that the agent uses tools correctly and produces expected outputs.
 */

import { expect } from "bun:test";

// Types for scenario-based testing
export interface ScenarioStep {
  /** User message to send */
  user?: string;
  /** Expected tool to be called */
  expectTool?: string;
  /** Expected action parameter (for tools with operation/action params) */
  expectAction?: string;
  /** Custom validation function for the result */
  validate?: (result: AgentResult) => void;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface AgentResult {
  /** Agent's text response */
  content: string;
  /** Tool calls made by the agent */
  tool_calls: ToolCall[];
  /** Whether the interaction completed successfully */
  success: boolean;
  /** Any error message */
  error?: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ScenarioOptions {
  /** Base URL for the Letta API */
  baseUrl?: string;
  /** Default timeout for each step */
  defaultTimeout?: number;
  /** Whether to log each step */
  verbose?: boolean;
}

/**
 * Run a multi-step scenario against an agent
 *
 * @example
 * ```ts
 * import { test } from "bun:test";
 * import { runScenario } from "./helpers";
 *
 * test("user can create world with rules", async () => {
 *   await runScenario("dsf-world-agent", [
 *     {
 *       user: "Create a new sci-fi world called 'Nebula Prime'",
 *       expectTool: "world_manager",
 *       expectAction: "save"
 *     },
 *     {
 *       user: "Add a rule: FTL travel requires fold drives",
 *       expectTool: "world_manager",
 *       expectAction: "update"
 *     },
 *     {
 *       user: "Show me the world's rules",
 *       validate: (r) => {
 *         expect(r.content).toContain("fold drive");
 *       }
 *     }
 *   ]);
 * });
 * ```
 */
export async function runScenario(
  agentId: string,
  steps: ScenarioStep[],
  options: ScenarioOptions = {}
): Promise<AgentResult> {
  const {
    baseUrl = process.env.LETTA_BASE_URL || "http://localhost:8283",
    defaultTimeout = 30000,
    verbose = false,
  } = options;

  let lastResult: AgentResult = {
    content: "",
    tool_calls: [],
    success: true,
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = i + 1;

    if (verbose) {
      console.log(`[Step ${stepNum}/${steps.length}]`, step.user || "(validation only)");
    }

    if (step.user) {
      lastResult = await sendMessage(agentId, step.user, {
        baseUrl,
        timeout: step.timeout || defaultTimeout,
      });

      if (!lastResult.success) {
        throw new Error(`Step ${stepNum} failed: ${lastResult.error}`);
      }
    }

    // Validate expected tool call
    if (step.expectTool) {
      const toolCall = lastResult.tool_calls.find((t) => t.name === step.expectTool);
      if (!toolCall) {
        throw new Error(
          `Step ${stepNum}: Expected tool '${step.expectTool}' was not called. ` +
            `Tools called: ${lastResult.tool_calls.map((t) => t.name).join(", ") || "none"}`
        );
      }

      if (step.expectAction) {
        const action =
          (toolCall.args.action as string) ||
          (toolCall.args.operation as string);
        if (action !== step.expectAction) {
          throw new Error(
            `Step ${stepNum}: Expected action '${step.expectAction}', got '${action}'`
          );
        }
      }
    }

    // Run custom validation
    if (step.validate) {
      try {
        step.validate(lastResult);
      } catch (e) {
        throw new Error(`Step ${stepNum} validation failed: ${e}`);
      }
    }
  }

  return lastResult;
}

/**
 * Send a single message to an agent
 */
export async function sendMessage(
  agentId: string,
  message: string,
  options: { baseUrl: string; timeout: number }
): Promise<AgentResult> {
  const { baseUrl, timeout } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/v1/agents/${agentId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        content: "",
        tool_calls: [],
        success: false,
        error: `HTTP ${response.status}: ${await response.text()}`,
      };
    }

    const data = await response.json();
    return parseAgentResponse(data);
  } catch (e) {
    clearTimeout(timeoutId);
    return {
      content: "",
      tool_calls: [],
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Parse the Letta API response into our AgentResult format
 */
function parseAgentResponse(data: unknown): AgentResult {
  const result: AgentResult = {
    content: "",
    tool_calls: [],
    success: true,
  };

  if (!Array.isArray(data)) {
    return result;
  }

  for (const msg of data) {
    if (msg.message_type === "assistant_message" && msg.content) {
      result.content += msg.content;
    }
    if (msg.message_type === "tool_call_message") {
      result.tool_calls.push({
        name: msg.tool_call?.name || "",
        args: msg.tool_call?.arguments || {},
      });
    }
    if (msg.message_type === "tool_return_message") {
      // Match tool return to most recent tool call
      const lastCall = result.tool_calls[result.tool_calls.length - 1];
      if (lastCall) {
        lastCall.result = msg.tool_return;
      }
    }
  }

  return result;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 10000, interval = 500, message = "Condition not met" } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Timeout: ${message}`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a test agent for E2E testing
 */
export async function createTestAgent(
  name: string,
  options: { baseUrl?: string; tools?: string[] } = {}
): Promise<string> {
  const { baseUrl = process.env.LETTA_BASE_URL || "http://localhost:8283", tools = [] } = options;

  const response = await fetch(`${baseUrl}/v1/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `test-${name}-${Date.now()}`,
      tools,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test agent: ${await response.text()}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Delete a test agent
 */
export async function deleteTestAgent(
  agentId: string,
  options: { baseUrl?: string } = {}
): Promise<void> {
  const { baseUrl = process.env.LETTA_BASE_URL || "http://localhost:8283" } = options;

  await fetch(`${baseUrl}/v1/agents/${agentId}`, {
    method: "DELETE",
  });
}
