/**
 * Agent Bus Client for CLI
 *
 * Connects to Agent Bus and forwards canvas interactions to the Letta agent
 */

import type { AgentBusMessage } from './types';

const AGENT_BUS_URL = 'ws://localhost:8284/ws?type=agent';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

type InteractionHandler = (interaction: {
  componentId: string;
  interactionType: string;
  data: any;
  target?: string;
}) => Promise<void>;

let interactionHandler: InteractionHandler | null = null;

/**
 * Set the handler for canvas interactions
 */
export function setInteractionHandler(handler: InteractionHandler) {
  interactionHandler = handler;
}

/**
 * Connect to Agent Bus
 */
export function connectToAgentBus(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    console.log('[CLI Agent Bus] Connecting to Agent Bus...');

    try {
      ws = new WebSocket(AGENT_BUS_URL);

      ws.onopen = () => {
        console.log('[CLI Agent Bus] Connected to Agent Bus');
        reconnectAttempts = 0;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString()) as AgentBusMessage;
          handleMessage(message);
        } catch (err) {
          console.error('[CLI Agent Bus] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[CLI Agent Bus] Disconnected from Agent Bus');
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('[CLI Agent Bus] Connection error:', error);
        // Don't reject on error - onclose will be called
      };
    } catch (err) {
      console.error('[CLI Agent Bus] Failed to create WebSocket:', err);
      reject(err);
    }
  });
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[CLI Agent Bus] Max reconnection attempts reached');
    return;
  }

  reconnectAttempts++;
  console.log(`[CLI Agent Bus] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  setTimeout(() => {
    connectToAgentBus().catch(() => {
      // Error already logged
    });
  }, RECONNECT_DELAY);
}

/**
 * Handle incoming messages from Agent Bus
 */
function handleMessage(message: AgentBusMessage) {
  if (message.type === 'connect') {
    console.log(`[CLI Agent Bus] Registered as ${(message as any).clientType}:${(message as any).clientId}`);
    return;
  }

  if (message.type === 'interaction') {
    const interaction = message as {
      type: 'interaction';
      componentId: string;
      interactionType: string;
      data: any;
      target?: string;
    };

    console.log('[CLI Agent Bus] Received interaction:', {
      componentId: interaction.componentId,
      interactionType: interaction.interactionType,
    });

    if (interactionHandler) {
      interactionHandler({
        componentId: interaction.componentId,
        interactionType: interaction.interactionType,
        data: interaction.data,
        target: interaction.target,
      }).catch((err) => {
        console.error('[CLI Agent Bus] Error handling interaction:', err);
      });
    } else {
      console.warn('[CLI Agent Bus] No interaction handler registered');
    }
  }
}

/**
 * Send a message to the Agent Bus
 */
export function sendToAgentBus(message: AgentBusMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[CLI Agent Bus] Not connected');
    return;
  }

  ws.send(JSON.stringify(message));
}

/**
 * Check if connected to Agent Bus
 */
export function isConnectedToAgentBus(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

/**
 * Disconnect from Agent Bus
 */
export function disconnectFromAgentBus() {
  if (ws) {
    ws.close();
    ws = null;
  }
}
