/**
 * canvas_ui - Agent tool for creating dynamic UI components in the canvas
 *
 * Allows agents to create inline visualizations, interactive elements, and
 * multimedia enhancements for stories and worlds displayed in the canvas.
 */

import type { CanvasUIMessage, StateChangeMessage, InteractionMessage } from '../agent-bus/types';
import type { ComponentSpec } from '../canvas/components/types';

const AGENT_BUS_URL = process.env.AGENT_BUS_URL || 'ws://localhost:8284/ws?type=agent';

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
  const validInteractions = interactionQueue.filter(i => now - i.timestamp < INTERACTION_TTL_MS);

  // Clear the queue
  interactionQueue.length = 0;

  return validInteractions;
}

/**
 * Peek at pending interactions without clearing
 */
export function peekCanvasInteractions(): QueuedInteraction[] {
  const now = Date.now();
  return interactionQueue.filter(i => now - i.timestamp < INTERACTION_TTL_MS);
}

/**
 * Get count of pending interactions
 */
export function getInteractionCount(): number {
  const now = Date.now();
  return interactionQueue.filter(i => now - i.timestamp < INTERACTION_TTL_MS).length;
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

  console.log(`[canvas_ui] Queued interaction: ${interactionType} on ${componentId} (queue size: ${interactionQueue.length})`);

  // Also try TypeScript callbacks for immediate handling
  if (target && interactionCallbacks.has(target)) {
    const callback = interactionCallbacks.get(target)!;
    Promise.resolve(callback(data)).catch(err => {
      console.error(`[canvas_ui] Interaction callback error for ${target}:`, err);
    });
    return;
  }

  if (interactionCallbacks.has(componentId)) {
    const callback = interactionCallbacks.get(componentId)!;
    Promise.resolve(callback({ ...data, interactionType })).catch(err => {
      console.error(`[canvas_ui] Interaction callback error for ${componentId}:`, err);
    });
  }
}

// ============================================================================
// Tool Interface
// ============================================================================

interface CanvasUIArgs {
  target: string;
  spec: ComponentSpec;
  action?: 'create' | 'update' | 'remove';
  mode?: 'overlay' | 'fullscreen' | 'inline';
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
          handleInteraction(message as InteractionMessage);
        }
      } catch (err) {
        console.error('[canvas_ui] Failed to parse message:', err);
      }
    });
  });
}

// ============================================================================
// State Broadcast
// ============================================================================

/**
 * Broadcast state change to all connected clients (Canvas + CLI)
 */
export async function broadcastStateChange(
  event: StateChangeMessage['event'],
  data: StateChangeMessage['data']
): Promise<void> {
  try {
    const ws = await ensureAgentBusConnection();

    const message: StateChangeMessage = {
      type: 'state_change',
      event,
      data,
    };

    ws.send(JSON.stringify(message));
    console.log(`[canvas_ui] Broadcast state change: ${event}`);
  } catch (error) {
    console.error('[canvas_ui] Failed to broadcast state change:', error);
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
  const { target, spec, action = 'create', mode = 'overlay' } = args;

  try {
    const ws = await ensureAgentBusConnection();

    const componentId = spec.id || `canvas-${Date.now()}`;

    const message: CanvasUIMessage = {
      type: 'canvas_ui',
      action,
      target,
      componentId,
      spec: action === 'remove' ? undefined : spec,
      mode,
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
