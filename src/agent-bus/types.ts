/**
 * Agent Bus - Message Protocol
 *
 * Bidirectional communication between CLI, Browser, and Agent
 * Unified WebSocket architecture
 *
 * Phase 0 Migration: Adding json-render tree format support
 * - spec: Legacy ComponentSpec format (backwards compatibility)
 * - tree: New json-render tree format (type-safe, validated by Zod)
 */

import type { ComponentSpec } from "../canvas/components/types";

/**
 * json-render tree format
 *
 * Standard format from Vercel's json-render framework
 * See: https://json-render.dev/
 */
export interface JsonRenderTree {
  type: string; // Component name from catalog
  props: Record<string, unknown>; // Validated by Zod schema
  key: string; // Unique identifier for this component instance
  children?: JsonRenderTree[]; // Nested children
}

// ============================================================================
// Client Types
// ============================================================================

export type ClientType = "browser" | "cli";

export interface ConnectedClient {
  id: string;
  type: ClientType;
}

// ============================================================================
// Stream Chunk (from Letta orchestrator)
// ============================================================================

export interface StreamChunk {
  type:
    | "reasoning"
    | "reasoning_end"
    | "tool_call"
    | "tool_result"
    | "assistant"
    | "assistant_end"
    | "error"
    | "done"
    | "usage";
  id?: string;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  toolStatus?: "pending" | "running" | "success" | "error";
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  stopReason?: string;
}

// ============================================================================
// Client → Server Messages
// ============================================================================

/**
 * Chat message from CLI/Browser to agent
 */
export interface ChatMessage {
  type: "chat_message";
  content: string;
  context?: {
    worldId?: string;
    storyId?: string;
  };
}

/**
 * Canvas → Agent: User interaction events
 */
export interface InteractionMessage {
  type: "interaction";
  componentId: string;
  interactionType: string; // 'click', 'dialog_change', 'input_change', etc.
  data: any;
  target?: string; // Optional callback handler name from spec
}

/**
 * Ping for keep-alive
 */
export interface PingMessage {
  type: "ping";
}

// ============================================================================
// Server → Client Messages
// ============================================================================

/**
 * Connection confirmation from server
 */
export interface ConnectMessage {
  type: "connect";
  clientId: string;
  sessionId: string;
  connectedClients: ConnectedClient[];
}

/**
 * Streaming chat response chunk
 */
export interface ChatChunkMessage {
  type: "chat_chunk";
  chunk: StreamChunk;
}

/**
 * Agent → Canvas: Create or update UI components
 *
 * Phase 0 Migration:
 * - Supports both `spec` (legacy) and `tree` (json-render) formats
 * - During transition, renderer checks for `tree` first, then falls back to `spec`
 * - Once migration is complete, `spec` field will be removed
 */
export interface CanvasUIMessage {
  type: "canvas_ui";
  action: "create" | "update" | "remove";
  target: string; // Mount point: 'story_segment_123', 'world_overview', 'floating'
  componentId: string; // Unique ID for this component

  // Legacy format (Phase 0: backwards compatibility)
  spec?: ComponentSpec; // OLD: Custom ComponentSpec format

  // New format (Phase 0: json-render migration)
  tree?: JsonRenderTree; // NEW: json-render tree format with Zod validation

  mode?: "overlay" | "fullscreen" | "inline"; // How to display: overlay (floating), fullscreen (takeover), inline (in content)
}

/**
 * Agent → Canvas/CLI: State change notifications
 */
export interface StateChangeMessage {
  type: "state_change";
  event:
    | "story_started"
    | "story_continued"
    | "branch_selected"
    | "world_entered"
    | "image_generated"
    | "agent_thinking"
    | "agent_done";
  data: {
    storyId?: string;
    worldId?: string;
    segmentId?: string;
    branchId?: string;
    assetPath?: string;
    message?: string;
    error?: boolean;
    [key: string]: any;
  };
}

/**
 * Agent → Canvas: Proactive suggestion
 */
export interface SuggestionMessage {
  type: "suggestion";
  payload: {
    id: string;
    priority: "high" | "medium" | "low";
    title: string;
    description: string; // Full text, never truncated
    actionId: string;
    actionLabel?: string;
    actionData?: any;
  };
}

/**
 * Client join notification
 */
export interface ClientJoinedMessage {
  type: "client_joined";
  client: ConnectedClient;
}

/**
 * Client leave notification
 */
export interface ClientLeftMessage {
  type: "client_left";
  clientId: string;
  clientType: ClientType;
}

/**
 * Error messages
 */
export interface ErrorMessage {
  type: "error";
  error: string;
  details?: any;
}

/**
 * Pong response
 */
export interface PongMessage {
  type: "pong";
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Messages from client to server
 */
export type ClientToServerMessage =
  | ChatMessage
  | InteractionMessage
  | PingMessage;

/**
 * Messages from server to client
 */
export type ServerToClientMessage =
  | ConnectMessage
  | ChatChunkMessage
  | CanvasUIMessage
  | StateChangeMessage
  | SuggestionMessage
  | ClientJoinedMessage
  | ClientLeftMessage
  | ErrorMessage
  | PongMessage;

/**
 * All messages (backward compatible alias)
 */
export type AgentBusMessage = ClientToServerMessage | ServerToClientMessage;

// ============================================================================
// Client Connection Info (legacy, for server use)
// ============================================================================

export interface AgentBusClient {
  id: string;
  type: ClientType;
  ws: any; // WebSocket instance
  connectedAt: Date;
}
