/**
 * canvas_ui - Agent tool for creating dynamic UI components in the canvas
 *
 * Allows agents to create inline visualizations, interactive elements, and
 * multimedia enhancements for stories and worlds displayed in the canvas.
 */

import WebSocket from 'ws';
import type { CanvasUIMessage } from '../agent-bus/types';
import type { ComponentSpec } from '../canvas/components/types';

const AGENT_BUS_URL = process.env.AGENT_BUS_URL || 'ws://localhost:8284/ws?type=agent';

let agentBusWs: WebSocket | null = null;
let isConnecting = false;

/**
 * Ensure Agent Bus connection is established
 */
function ensureAgentBusConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    // Return existing connection if ready
    if (agentBusWs && agentBusWs.readyState === WebSocket.OPEN) {
      resolve(agentBusWs);
      return;
    }

    // Wait for existing connection attempt
    if (isConnecting && agentBusWs) {
      agentBusWs.once('open', () => resolve(agentBusWs!));
      agentBusWs.once('error', reject);
      return;
    }

    // Create new connection
    isConnecting = true;
    agentBusWs = new WebSocket(AGENT_BUS_URL);

    agentBusWs.on('open', () => {
      console.log('[canvas_ui] Connected to Agent Bus');
      isConnecting = false;
      resolve(agentBusWs!);
    });

    agentBusWs.on('error', (error) => {
      console.error('[canvas_ui] Agent Bus connection error:', error);
      isConnecting = false;
      reject(new Error('Failed to connect to Agent Bus'));
    });

    agentBusWs.on('close', () => {
      console.log('[canvas_ui] Agent Bus connection closed');
      agentBusWs = null;
      isConnecting = false;
    });

    agentBusWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'interaction') {
          console.log('[canvas_ui] User interaction:', message);
          // TODO: Route interaction back to agent context
        }
      } catch (err) {
        console.error('[canvas_ui] Failed to parse message:', err);
      }
    });
  });
}

export interface CanvasUIParams {
  /**
   * Where to mount the component in the canvas.
   *
   * Mount points:
   * - "floating": Appears as overlay (bottom-right)
   * - "story_segment_{id}": Inline in specific story segment
   * - "world_overview": In world overview section
   * - "story_header": At top of current story
   *
   * Future mount points will include inline positions within story content.
   */
  target: string;

  /**
   * The UI component specification (JSON).
   *
   * Available components:
   * - Dialog: Modal dialogs with trigger buttons
   * - Button: Primary/secondary action buttons
   * - Text: Styled text (heading, body, caption)
   * - Stack: Vertical/horizontal layout container
   *
   * Example:
   * {
   *   type: "Dialog",
   *   id: "story-viz-1",
   *   props: {
   *     title: "Story Timeline",
   *     description: "Visual timeline of key events",
   *     trigger: {
   *       type: "Button",
   *       props: { label: "View Timeline", variant: "primary" }
   *     }
   *   },
   *   children: { ... }
   * }
   */
  spec: ComponentSpec;

  /**
   * Action to perform: create (new), update (existing), or remove.
   */
  action?: 'create' | 'update' | 'remove';
}

/**
 * Create or update dynamic UI in the canvas.
 *
 * Use this to add inline visualizations, interactive elements, and multimedia
 * enhancements to stories and worlds. The UI will appear in the canvas at the
 * specified target location.
 *
 * @param target - Where to mount the component (e.g., "floating", "story_segment_123")
 * @param spec - Component specification (JSON describing the UI)
 * @param action - Action to perform (default: "create")
 * @returns Success message or error
 */
export async function canvas_ui({
  target,
  spec,
  action = 'create',
}: CanvasUIParams): Promise<string> {
  try {
    const ws = await ensureAgentBusConnection();

    const componentId = spec.id || `canvas-${Date.now()}`;

    const message: CanvasUIMessage = {
      type: 'canvas_ui',
      action,
      target,
      componentId,
      spec: action === 'remove' ? undefined : spec,
    };

    ws.send(JSON.stringify(message));

    console.log(`[canvas_ui] Sent ${action} for ${componentId} at ${target}`);

    if (action === 'remove') {
      return `Removed component from ${target}`;
    }

    return `Component ${componentId} ${action === 'update' ? 'updated' : 'created'} at ${target}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[canvas_ui] Error:', errorMsg);
    return `Failed to ${action} UI component: ${errorMsg}`;
  }
}

// Tool metadata for Letta
export const canvas_ui_metadata = {
  name: 'canvas_ui',
  description: 'Create dynamic UI components in the canvas for inline visualizations and interactive elements',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Mount point: "floating", "story_segment_{id}", "world_overview", etc.',
      },
      spec: {
        type: 'object',
        description: 'Component specification (JSON) - Dialog, Button, Text, Stack',
      },
      action: {
        type: 'string',
        enum: ['create', 'update', 'remove'],
        description: 'Action to perform (default: create)',
      },
    },
    required: ['target', 'spec'],
  },
};
