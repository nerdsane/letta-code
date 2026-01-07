/**
 * canvas_ui - Agent tool for creating dynamic UI components in the canvas
 *
 * Allows agents to create inline visualizations, interactive elements, and
 * multimedia enhancements for stories and worlds displayed in the canvas.
 */

import type { CanvasUIMessage } from '../../agent-bus/types';
import type { ComponentSpec } from '../../canvas/components/types';

const AGENT_BUS_URL = process.env.AGENT_BUS_URL || 'ws://localhost:8284/ws?type=agent';

// ============================================================================
// Tool Interface
// ============================================================================

interface CanvasUIArgs {
  target: string;
  spec: ComponentSpec;
  action?: 'create' | 'update' | 'remove';
}

interface CanvasUIResult {
  toolReturn: string;
  status: 'success' | 'error';
}

// ============================================================================
// WebSocket Connection Management
// ============================================================================

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
      const existingWs = agentBusWs;
      const onOpen = () => {
        existingWs.removeEventListener('open', onOpen);
        existingWs.removeEventListener('error', onError);
        resolve(existingWs);
      };
      const onError = () => {
        existingWs.removeEventListener('open', onOpen);
        existingWs.removeEventListener('error', onError);
        reject(new Error('Connection failed'));
      };
      existingWs.addEventListener('open', onOpen);
      existingWs.addEventListener('error', onError);
      return;
    }

    // Create new connection
    isConnecting = true;
    agentBusWs = new WebSocket(AGENT_BUS_URL);
    const ws = agentBusWs;

    ws.addEventListener('open', () => {
      console.log('[canvas_ui] Connected to Agent Bus');
      isConnecting = false;
      resolve(ws);
    });

    ws.addEventListener('error', () => {
      console.error('[canvas_ui] Agent Bus connection error');
      isConnecting = false;
      reject(new Error('Failed to connect to Agent Bus'));
    });

    ws.addEventListener('close', () => {
      console.log('[canvas_ui] Agent Bus connection closed');
      agentBusWs = null;
      isConnecting = false;
    });

    ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
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
  const { target, spec, action = 'create' } = args;

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

    let resultMessage: string;
    if (action === 'remove') {
      resultMessage = `Removed component from ${target}`;
    } else {
      resultMessage = `Component ${componentId} ${action === 'update' ? 'updated' : 'created'} at ${target}`;
    }

    return {
      toolReturn: resultMessage,
      status: 'success',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[canvas_ui] Error:', errorMsg);
    return {
      toolReturn: `Failed to ${action} UI component: ${errorMsg}`,
      status: 'error',
    };
  }
}
