/**
 * canvas_ui - Agent tool for creating dynamic UI components in the canvas
 *
 * Allows agents to create inline visualizations, interactive elements, and
 * multimedia enhancements for stories and worlds displayed in the canvas.
 */

import type {
  CanvasUIMessage,
  InteractionMessage,
  StateChangeMessage,
  JsonRenderTree,
} from "../../agent-bus/types";
import type { ComponentSpec } from "../../canvas/components/types";

const AGENT_BUS_URL =
  process.env.AGENT_BUS_URL || "ws://localhost:8284/ws?type=agent";

// ============================================================================
// Interaction Queue - For agent to poll user interactions
// ============================================================================

export interface QueuedInteraction {
  id: string;
  timestamp: number;
  componentId: string;
  interactionType: string;
  target?: string;
  data: any;
}

const interactionQueue: QueuedInteraction[] = [];
const MAX_QUEUE_SIZE = 100;
const INTERACTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get all pending interactions from the queue
 * Clears the queue after reading (agent has received them)
 */
export function getCanvasInteractions(): QueuedInteraction[] {
  // Remove expired interactions
  const now = Date.now();
  const validInteractions = interactionQueue.filter(
    (i) => now - i.timestamp < INTERACTION_TTL_MS,
  );

  // Clear the queue
  interactionQueue.length = 0;

  return validInteractions;
}

/**
 * Peek at pending interactions without clearing
 */
export function peekCanvasInteractions(): QueuedInteraction[] {
  const now = Date.now();
  return interactionQueue.filter((i) => now - i.timestamp < INTERACTION_TTL_MS);
}

/**
 * Get count of pending interactions
 */
export function getInteractionCount(): number {
  const now = Date.now();
  return interactionQueue.filter((i) => now - i.timestamp < INTERACTION_TTL_MS)
    .length;
}

// ============================================================================
// Interaction Callback Registry (for TypeScript-side handlers)
// ============================================================================

type InteractionCallback = (data: any) => void | Promise<void>;
const interactionCallbacks = new Map<string, InteractionCallback>();

/**
 * Register a callback for when a specific interaction target is triggered
 */
export function onInteraction(target: string, callback: InteractionCallback) {
  interactionCallbacks.set(target, callback);
  return () => interactionCallbacks.delete(target); // Return unsubscribe function
}

/**
 * Handle incoming interaction from canvas
 * - Queues interaction for agent polling
 * - Also fires any registered TypeScript callbacks
 */
function handleInteraction(message: InteractionMessage) {
  const { target, data, componentId, interactionType } = message;

  // Always queue the interaction for agent polling
  const queuedInteraction: QueuedInteraction = {
    id: `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    componentId,
    interactionType,
    target,
    data,
  };

  interactionQueue.push(queuedInteraction);

  // Trim queue if too large
  while (interactionQueue.length > MAX_QUEUE_SIZE) {
    interactionQueue.shift();
  }

  // Also try TypeScript callbacks for immediate handling
  if (target && interactionCallbacks.has(target)) {
    const callback = interactionCallbacks.get(target)!;
    Promise.resolve(callback(data)).catch((err) => {
      console.error(
        `[canvas_ui] Interaction callback error for ${target}:`,
        err,
      );
    });
    return;
  }

  if (interactionCallbacks.has(componentId)) {
    const callback = interactionCallbacks.get(componentId)!;
    Promise.resolve(callback({ ...data, interactionType })).catch((err) => {
      console.error(
        `[canvas_ui] Interaction callback error for ${componentId}:`,
        err,
      );
    });
  }
}

// ============================================================================
// Tool Interface
// ============================================================================

interface CanvasUIArgs {
  target: string;
  spec: ComponentSpec;
  action?: "create" | "update" | "remove";
  mode?: "overlay" | "fullscreen" | "inline";
}

interface CanvasUIResult {
  toolReturn: string;
  status: "success" | "error";
}

// ============================================================================
// WebSocket Connection Management
// ============================================================================

let agentBusWs: WebSocket | null = null;
let isConnecting = false;

// Pending connection callbacks for concurrent requests
let pendingCallbacks: {
  resolve: (ws: WebSocket) => void;
  reject: (err: Error) => void;
}[] = [];

/**
 * Ensure Agent Bus connection is established
 * Uses native WebSocket API (not Node.js ws library)
 */
function ensureAgentBusConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    // Return existing connection if ready
    if (agentBusWs && agentBusWs.readyState === WebSocket.OPEN) {
      resolve(agentBusWs);
      return;
    }

    // Wait for existing connection attempt
    if (isConnecting) {
      pendingCallbacks.push({ resolve, reject });
      return;
    }

    // Create new connection
    isConnecting = true;
    const ws = new WebSocket(AGENT_BUS_URL);

    ws.onopen = () => {
      isConnecting = false;
      agentBusWs = ws;
      resolve(ws);
      // Resolve any pending callbacks
      for (const cb of pendingCallbacks) {
        cb.resolve(ws);
      }
      pendingCallbacks = [];
    };

    ws.onerror = (event) => {
      console.error("[canvas_ui] Agent Bus connection error:", event);
      isConnecting = false;
      const err = new Error("Failed to connect to Agent Bus");
      reject(err);
      // Reject any pending callbacks
      for (const cb of pendingCallbacks) {
        cb.reject(err);
      }
      pendingCallbacks = [];
    };

    ws.onclose = () => {
      agentBusWs = null;
      isConnecting = false;
    };

    ws.onmessage = (event) => {
      try {
        const data =
          typeof event.data === "string" ? event.data : event.data.toString();
        const message = JSON.parse(data);
        if (message.type === "interaction") {
          handleInteraction(message as InteractionMessage);
        }
      } catch (err) {
        console.error("[canvas_ui] Failed to parse message:", err);
      }
    };
  });
}

// ============================================================================
// ComponentSpec → json-render Tree Conversion
// ============================================================================

/**
 * Convert ComponentSpec (legacy format) to JsonRenderTree (json-render format)
 *
 * This enables backwards compatibility during Phase 0 migration.
 * Agents can continue using ComponentSpec, but we send json-render tree format.
 */
function componentSpecToTree(spec: ComponentSpec): JsonRenderTree {
  const tree: JsonRenderTree = {
    type: spec.type,
    props: (spec as any).props || {},
    key: spec.id || `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  // Handle children recursively
  const anySpec = spec as any;
  if (anySpec.children) {
    if (Array.isArray(anySpec.children)) {
      tree.children = anySpec.children.map(componentSpecToTree);
    } else {
      tree.children = [componentSpecToTree(anySpec.children)];
    }
  }

  return tree;
}

// ============================================================================
// State Broadcast
// ============================================================================

/**
 * Broadcast state change to all connected clients (Canvas + CLI)
 */
export async function broadcastStateChange(
  event: StateChangeMessage["event"],
  data: StateChangeMessage["data"],
): Promise<void> {
  try {
    const ws = await ensureAgentBusConnection();

    const message: StateChangeMessage = {
      type: "state_change",
      event,
      data,
    };

    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error("[canvas_ui] Failed to broadcast state change:", error);
    throw error; // Re-throw so callers know about the failure
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Create or update dynamic UI in the canvas.
 *
 * Use this to add inline visualizations, interactive elements, and multimedia
 * enhancements to stories and worlds. The UI will appear in the canvas at the
 * specified target location.
 */
export async function canvas_ui(args: CanvasUIArgs): Promise<CanvasUIResult> {
  const { target, spec, action = "create", mode = "overlay" } = args;

  try {
    const ws = await ensureAgentBusConnection();

    const componentId = spec.id || `canvas-${Date.now()}`;

    // Phase 0 Migration: Convert ComponentSpec to json-render tree
    const tree = action !== "remove" ? componentSpecToTree(spec) : undefined;

    const message: CanvasUIMessage = {
      type: "canvas_ui",
      action,
      target,
      componentId,

      // Send both formats during transition for backwards compatibility
      spec: action === "remove" ? undefined : spec, // Legacy format
      tree: tree, // New json-render format

      mode,
    };

    ws.send(JSON.stringify(message));

    let resultMessage: string;
    if (action === "remove") {
      resultMessage = `Removed component from ${target}`;
    } else {
      resultMessage = `Component ${componentId} ${action === "update" ? "updated" : "created"} at ${target}`;
    }

    return {
      toolReturn: resultMessage,
      status: "success",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[canvas_ui] Error:", errorMsg);
    return {
      toolReturn: `Failed to ${action} UI component: ${errorMsg}`,
      status: "error",
    };
  }
}
