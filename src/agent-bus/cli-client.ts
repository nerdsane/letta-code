/**
 * Unified WebSocket Client for CLI
 *
 * Connects to the unified WebSocket server and enables:
 * - Sending chat messages to the agent
 * - Receiving streaming responses
 * - Receiving canvas UI updates
 * - Seeing when browser clients connect/disconnect
 */

import type {
  CanvasUIMessage,
  ClientToServerMessage,
  ConnectedClient,
  InteractionMessage,
  ServerToClientMessage,
  StreamChunk,
  SuggestionMessage,
} from "./types";

const WS_URL = "ws://localhost:8284/ws";

let ws: WebSocket | null = null;
let clientId: string | null = null;
let sessionId: string | null = null;
let connectedClients: ConnectedClient[] = [];
let reconnectAttempts = 0;
let pingInterval: ReturnType<typeof setInterval> | null = null;

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

// ============================================================================
// Event Handlers
// ============================================================================

type ChatChunkHandler = (chunk: StreamChunk) => void;
type CanvasUIHandler = (message: CanvasUIMessage) => void;
type StateChangeHandler = (event: string, data: Record<string, any>) => void;
type SuggestionHandler = (suggestion: SuggestionMessage["payload"]) => void;
type InteractionHandler = (interaction: {
  componentId: string;
  interactionType: string;
  data: any;
  target?: string;
}) => Promise<void>;
type ClientJoinedHandler = (client: ConnectedClient) => void;
type ClientLeftHandler = (clientId: string, clientType: string) => void;
type ConnectHandler = (
  clientId: string,
  sessionId: string,
  clients: ConnectedClient[],
) => void;
type DisconnectHandler = () => void;
type ErrorHandler = (error: string) => void;

let onChatChunk: ChatChunkHandler | null = null;
let onCanvasUI: CanvasUIHandler | null = null;
let onStateChange: StateChangeHandler | null = null;
let onSuggestion: SuggestionHandler | null = null;
let onInteraction: InteractionHandler | null = null;
let onClientJoined: ClientJoinedHandler | null = null;
let onClientLeft: ClientLeftHandler | null = null;
let onConnect: ConnectHandler | null = null;
let onDisconnect: DisconnectHandler | null = null;
let onError: ErrorHandler | null = null;

/**
 * Set event handlers
 */
export function setHandlers(handlers: {
  onChatChunk?: ChatChunkHandler;
  onCanvasUI?: CanvasUIHandler;
  onStateChange?: StateChangeHandler;
  onSuggestion?: SuggestionHandler;
  onInteraction?: InteractionHandler;
  onClientJoined?: ClientJoinedHandler;
  onClientLeft?: ClientLeftHandler;
  onConnect?: ConnectHandler;
  onDisconnect?: DisconnectHandler;
  onError?: ErrorHandler;
}) {
  if (handlers.onChatChunk) onChatChunk = handlers.onChatChunk;
  if (handlers.onCanvasUI) onCanvasUI = handlers.onCanvasUI;
  if (handlers.onStateChange) onStateChange = handlers.onStateChange;
  if (handlers.onSuggestion) onSuggestion = handlers.onSuggestion;
  if (handlers.onInteraction) onInteraction = handlers.onInteraction;
  if (handlers.onClientJoined) onClientJoined = handlers.onClientJoined;
  if (handlers.onClientLeft) onClientLeft = handlers.onClientLeft;
  if (handlers.onConnect) onConnect = handlers.onConnect;
  if (handlers.onDisconnect) onDisconnect = handlers.onDisconnect;
  if (handlers.onError) onError = handlers.onError;
}

// Legacy handler for backward compatibility
let interactionHandler: InteractionHandler | null = null;

/**
 * Set the handler for canvas interactions (legacy API)
 */
export function setInteractionHandler(handler: InteractionHandler) {
  interactionHandler = handler;
  onInteraction = handler;
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Generate a session ID for CLI
 */
function generateSessionId(): string {
  // Use a stable session ID per terminal session
  const now = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `cli-session-${now}-${random}`;
}

/**
 * Connect to the unified WebSocket server
 */
export function connectToAgentBus(options?: {
  sessionId?: string;
  userId?: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const useSessionId = options?.sessionId || generateSessionId();
    const userId = options?.userId || "cli-user";
    const fullUrl = `${WS_URL}?type=cli&sessionId=${useSessionId}&userId=${userId}`;

    console.log("[CLI WS] Connecting to unified WebSocket server...");

    try {
      ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        console.log("[CLI WS] Connected");
        reconnectAttempts = 0;
        startPing();
        // Don't resolve yet - wait for connect message
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(
            event.data.toString(),
          ) as ServerToClientMessage;
          handleMessage(message, resolve);
        } catch (err) {
          console.error("[CLI WS] Failed to parse message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("[CLI WS] Disconnected", event.code, event.reason);
        stopPing();
        ws = null;
        clientId = null;
        connectedClients = [];
        onDisconnect?.();
        scheduleReconnect();
      };

      ws.onerror = (_error) => {
        console.error("[CLI WS] Connection error");
        onError?.("WebSocket connection error");
        // Don't reject on error - onclose will be called
      };
    } catch (err) {
      console.error("[CLI WS] Failed to create WebSocket:", err);
      reject(err);
    }
  });
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("[CLI WS] Max reconnection attempts reached");
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * 1.5 ** (reconnectAttempts - 1);

  console.log(
    `[CLI WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
  );

  setTimeout(() => {
    connectToAgentBus({ sessionId: sessionId || undefined }).catch(() => {
      // Error already logged
    });
  }, delay);
}

/**
 * Start ping interval
 */
function startPing() {
  pingInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, PING_INTERVAL);
}

/**
 * Stop ping interval
 */
function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Handle incoming messages from server
 */
function handleMessage(
  message: ServerToClientMessage,
  connectResolve?: (value: undefined) => void,
) {
  switch (message.type) {
    case "connect":
      clientId = message.clientId;
      sessionId = message.sessionId;
      connectedClients = message.connectedClients || [];
      console.log("[CLI WS] Assigned ID:", clientId);
      console.log("[CLI WS] Session:", sessionId);
      console.log(
        "[CLI WS] Other clients:",
        connectedClients.length > 0
          ? connectedClients.map((c) => `${c.type}:${c.id}`).join(", ")
          : "none",
      );
      onConnect?.(clientId, sessionId, connectedClients);
      connectResolve?.();
      break;

    case "client_joined":
      connectedClients.push(message.client);
      console.log(
        `[CLI WS] ${message.client.type} client joined:`,
        message.client.id,
      );
      onClientJoined?.(message.client);
      break;

    case "client_left":
      connectedClients = connectedClients.filter(
        (c) => c.id !== message.clientId,
      );
      console.log(
        `[CLI WS] ${message.clientType} client left:`,
        message.clientId,
      );
      onClientLeft?.(message.clientId, message.clientType);
      break;

    case "chat_chunk":
      onChatChunk?.(message.chunk);
      break;

    case "canvas_ui":
      console.log(
        `[CLI WS] Canvas UI: ${message.action} ${message.componentId}`,
      );
      onCanvasUI?.(message);
      break;

    case "state_change":
      console.log(`[CLI WS] State change: ${message.event}`);
      onStateChange?.(message.event, message.data);
      break;

    case "suggestion":
      console.log(`[CLI WS] Suggestion: ${message.payload.title}`);
      onSuggestion?.(message.payload);
      break;

    case "error":
      console.error("[CLI WS] Server error:", message.error, message.details);
      onError?.(message.error);
      break;

    case "pong":
      // Heartbeat response, ignore
      break;

    default:
      // Handle interaction messages (forwarded from browser)
      if ((message as any).type === "interaction") {
        const interaction = message as unknown as InteractionMessage;
        console.log("[CLI WS] Received interaction:", {
          componentId: interaction.componentId,
          interactionType: interaction.interactionType,
        });

        const handler = onInteraction || interactionHandler;
        if (handler) {
          handler({
            componentId: interaction.componentId,
            interactionType: interaction.interactionType,
            data: interaction.data,
            target: interaction.target,
          }).catch((err) => {
            console.error("[CLI WS] Error handling interaction:", err);
          });
        }
      } else {
        console.warn("[CLI WS] Unknown message type:", (message as any).type);
      }
  }
}

// ============================================================================
// Sending Messages
// ============================================================================

/**
 * Send a chat message to the agent
 */
export function sendChatMessage(
  content: string,
  context?: { worldId?: string; storyId?: string },
) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("[CLI WS] Not connected");
    return;
  }

  const message: ClientToServerMessage = {
    type: "chat_message",
    content,
    context,
  };

  console.log("[CLI WS] Sending chat message:", content.substring(0, 50));
  ws.send(JSON.stringify(message));
}

/**
 * Send an interaction (e.g., simulating button click)
 */
export function sendInteraction(
  componentId: string,
  interactionType: string,
  data: any,
  target?: string,
) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("[CLI WS] Not connected");
    return;
  }

  const message: ClientToServerMessage = {
    type: "interaction",
    componentId,
    interactionType,
    data,
    target,
  };

  console.log(
    "[CLI WS] Sending interaction:",
    interactionType,
    "on",
    componentId,
  );
  ws.send(JSON.stringify(message));
}

/**
 * Send a message to the server (legacy API)
 */
export function sendToAgentBus(message: ClientToServerMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("[CLI WS] Not connected");
    return;
  }

  ws.send(JSON.stringify(message));
}

// ============================================================================
// State Getters
// ============================================================================

/**
 * Check if connected to WebSocket server
 */
export function isConnectedToAgentBus(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

/**
 * Get the current client ID
 */
export function getClientId(): string | null {
  return clientId;
}

/**
 * Get the current session ID
 */
export function getSessionId(): string | null {
  return sessionId;
}

/**
 * Get list of connected clients
 */
export function getConnectedClients(): ConnectedClient[] {
  return [...connectedClients];
}

/**
 * Check if browser is connected
 */
export function isBrowserConnected(): boolean {
  return connectedClients.some((c) => c.type === "browser");
}

/**
 * Disconnect from WebSocket server
 */
export function disconnectFromAgentBus() {
  stopPing();
  if (ws) {
    ws.close(1000, "Client disconnect");
    ws = null;
  }
  clientId = null;
  sessionId = null;
  connectedClients = [];
}
