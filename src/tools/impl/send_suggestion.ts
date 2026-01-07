/**
 * send_suggestion - Agent tool for sending proactive suggestions to canvas
 *
 * Allows agents to send contextual suggestions that appear in the
 * AgentSuggestions panel in the canvas UI.
 */

import type { SuggestionMessage } from '../../agent-bus/types';

const AGENT_BUS_URL = process.env.AGENT_BUS_URL || 'ws://localhost:8284/ws?type=agent';

// ============================================================================
// Tool Interface
// ============================================================================

interface SendSuggestionArgs {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_id: string;
  action_label?: string;
  action_data?: any;
}

interface SendSuggestionResult {
  toolReturn: string;
  status: 'success' | 'error';
}

// ============================================================================
// WebSocket Connection (shared with canvas_ui)
// ============================================================================

let agentBusWs: WebSocket | null = null;
let isConnecting = false;
let pendingCallbacks: { resolve: (ws: WebSocket) => void; reject: (err: Error) => void }[] = [];

function ensureAgentBusConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (agentBusWs && agentBusWs.readyState === WebSocket.OPEN) {
      resolve(agentBusWs);
      return;
    }

    if (isConnecting) {
      pendingCallbacks.push({ resolve, reject });
      return;
    }

    isConnecting = true;
    const ws = new WebSocket(AGENT_BUS_URL);

    ws.onopen = () => {
      console.log('[send_suggestion] Connected to Agent Bus');
      isConnecting = false;
      agentBusWs = ws;
      resolve(ws);
      for (const cb of pendingCallbacks) {
        cb.resolve(ws);
      }
      pendingCallbacks = [];
    };

    ws.onerror = (event) => {
      console.error('[send_suggestion] Agent Bus connection error:', event);
      isConnecting = false;
      const err = new Error('Failed to connect to Agent Bus');
      reject(err);
      for (const cb of pendingCallbacks) {
        cb.reject(err);
      }
      pendingCallbacks = [];
    };

    ws.onclose = () => {
      console.log('[send_suggestion] Agent Bus connection closed');
      agentBusWs = null;
      isConnecting = false;
    };

    ws.onmessage = () => {
      // Suggestions are one-way, no response expected
    };
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Send a proactive suggestion to the canvas UI.
 *
 * Use this to offer contextual suggestions based on current state,
 * unused elements, story opportunities, or any other insights.
 */
export async function send_suggestion(args: SendSuggestionArgs): Promise<SendSuggestionResult> {
  const { title, description, priority, action_id, action_label, action_data } = args;

  try {
    const ws = await ensureAgentBusConnection();

    const suggestionId = `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const message: SuggestionMessage = {
      type: 'suggestion',
      payload: {
        id: suggestionId,
        priority,
        title,
        description,
        actionId: action_id,
        actionLabel: action_label,
        actionData: action_data,
      },
    };

    ws.send(JSON.stringify(message));

    console.log(`[send_suggestion] Sent suggestion: ${title} (${priority})`);

    return {
      toolReturn: `Suggestion "${title}" sent to canvas`,
      status: 'success',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[send_suggestion] Error:', errorMsg);
    return {
      toolReturn: `Failed to send suggestion: ${errorMsg}`,
      status: 'error',
    };
  }
}
