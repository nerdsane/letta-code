/**
 * Agent Bus - WebSocket Message Broker
 *
 * Routes messages between Agent/CLI and Canvas UI for bidirectional communication
 */

import type { ServerWebSocket } from "bun";
import type { AgentBusClient, AgentBusMessage } from "./types";

// ============================================================================
// State Management
// ============================================================================

const clients = new Map<string, AgentBusClient>();
let nextClientId = 1;

function generateClientId(): string {
  return `client-${Date.now()}-${nextClientId++}`;
}

// ============================================================================
// Message Routing
// ============================================================================

/**
 * Route message to appropriate clients
 * - canvas_ui messages → all canvas clients
 * - interaction messages → all agent clients
 */
function routeMessage(message: AgentBusMessage, senderId: string) {
  const sender = clients.get(senderId);
  if (!sender) {
    console.error(`[Agent Bus] Unknown sender: ${senderId}`);
    return;
  }

  console.log(
    `[Agent Bus] Routing ${message.type} from ${sender.type}:${senderId}`,
  );

  // Route canvas_ui messages to canvas clients
  if (message.type === "canvas_ui") {
    for (const [id, client] of clients.entries()) {
      if (client.type === "canvas" && id !== senderId) {
        try {
          client.ws.send(JSON.stringify(message));
          console.log(`[Agent Bus] → canvas:${id}`);
        } catch (err) {
          console.error(`[Agent Bus] Failed to send to canvas:${id}`, err);
        }
      }
    }
  }

  // Route interaction messages to agent clients
  if (message.type === "interaction") {
    for (const [id, client] of clients.entries()) {
      if (client.type === "agent" && id !== senderId) {
        try {
          client.ws.send(JSON.stringify(message));
          console.log(`[Agent Bus] → agent:${id}`);
        } catch (err) {
          console.error(`[Agent Bus] Failed to send to agent:${id}`, err);
        }
      }
    }
  }

  // Route state_change messages to all clients (both canvas and agent)
  if (message.type === "state_change") {
    for (const [id, client] of clients.entries()) {
      if (id !== senderId) {
        try {
          client.ws.send(JSON.stringify(message));
          console.log(
            `[Agent Bus] → ${client.type}:${id} (state_change: ${(message as any).event})`,
          );
        } catch (err) {
          console.error(
            `[Agent Bus] Failed to send to ${client.type}:${id}`,
            err,
          );
        }
      }
    }
  }

  // Route suggestion messages to canvas clients
  if (message.type === "suggestion") {
    for (const [id, client] of clients.entries()) {
      if (client.type === "canvas" && id !== senderId) {
        try {
          client.ws.send(JSON.stringify(message));
          console.log(
            `[Agent Bus] → canvas:${id} (suggestion: ${(message as any).payload?.title})`,
          );
        } catch (err) {
          console.error(`[Agent Bus] Failed to send to canvas:${id}`, err);
        }
      }
    }
  }
}

// ============================================================================
// WebSocket Server
// ============================================================================

type WebSocketData = { clientType: string; clientId: string };

export function startAgentBus(port: number = 8284) {
  console.log(`[Agent Bus] Starting on port ${port}...`);

  Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        const clientType = url.searchParams.get("type") || "unknown";
        const success = server.upgrade(req, {
          data: {
            clientType,
            clientId: generateClientId(),
          },
        });

        if (success) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Health check
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            clients: Array.from(clients.values()).map((c) => ({
              id: c.id,
              type: c.type,
              connectedAt: c.connectedAt,
            })),
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Agent Bus Server", { status: 200 });
    },

    websocket: {
      open(ws: ServerWebSocket<WebSocketData>) {
        const { clientId, clientType } = ws.data;
        const type =
          clientType === "agent" || clientType === "canvas"
            ? clientType
            : "agent";

        // Register client
        clients.set(clientId, {
          id: clientId,
          type,
          ws,
          connectedAt: new Date(),
        });

        console.log(
          `[Agent Bus] ${type}:${clientId} connected (${clients.size} total)`,
        );

        // Send connection confirmation
        ws.send(
          JSON.stringify({
            type: "connect",
            clientType: type,
            clientId,
          }),
        );
      },

      message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        const { clientId } = ws.data;

        try {
          const msg = JSON.parse(message.toString()) as AgentBusMessage;
          routeMessage(msg, clientId);
        } catch (err) {
          console.error(
            `[Agent Bus] Failed to parse message from ${clientId}:`,
            err,
          );
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Invalid message format",
              details: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      },

      close(ws: ServerWebSocket<WebSocketData>) {
        const { clientId, clientType } = ws.data;
        clients.delete(clientId);
        console.log(
          `[Agent Bus] ${clientType}:${clientId} disconnected (${clients.size} remaining)`,
        );
      },

      error(ws: ServerWebSocket<WebSocketData>, error: Error) {
        const { clientId } = ws.data;
        console.error(`[Agent Bus] WebSocket error for ${clientId}:`, error);
      },
    },
  });

  console.log(`[Agent Bus] ✨ Running at ws://localhost:${port}/ws`);
  console.log(`[Agent Bus] 📊 Health check: http://localhost:${port}/health`);
}

// Start server if run directly
if (import.meta.main) {
  startAgentBus();
}
