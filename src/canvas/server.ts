/**
 * Story Explorer Canvas Server
 *
 * A web interface for browsing DSF worlds and stories with live updates
 */

import { readdir, readFile, watch } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ServerWebSocket } from "bun";
import type { World, Story } from "../types/dsf";
import indexHtml from "./index.html";
import { getClient } from "../agent/client";
import { settingsManager } from "../settings-manager";

// ============================================================================
// Constants
// ============================================================================

const PORT = 3030;
const WORLDS_DIR = ".dsf/worlds";
const STORIES_DIR = ".dsf/stories";
const ASSETS_DIR = ".dsf/assets";

// ============================================================================
// Shared Agent State
// ============================================================================

let sharedAgentId: string | null = null;

// ============================================================================
// WebSocket Clients
// ============================================================================

const clients = new Set<ServerWebSocket>();

// ============================================================================
// Data Loading Functions
// ============================================================================

async function loadAllWorlds(): Promise<World[]> {
  if (!existsSync(WORLDS_DIR)) {
    return [];
  }

  const worlds: World[] = [];
  const files = await readdir(WORLDS_DIR);

  for (const file of files) {
    if (file.endsWith(".json")) {
      const content = await readFile(join(WORLDS_DIR, file), "utf-8");
      worlds.push(JSON.parse(content) as World);
    }
  }

  // Sort by last modified (most recent first)
  return worlds.sort((a, b) =>
    new Date(b.development.last_modified).getTime() -
    new Date(a.development.last_modified).getTime()
  );
}

async function loadWorld(checkpoint: string): Promise<World | null> {
  const filePath = join(WORLDS_DIR, `${checkpoint}.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as World;
}

async function loadAllStories(): Promise<Story[]> {
  if (!existsSync(STORIES_DIR)) {
    return [];
  }

  const stories: Story[] = [];
  const worldDirs = await readdir(STORIES_DIR);

  for (const worldDir of worldDirs) {
    const worldPath = join(STORIES_DIR, worldDir);
    try {
      const files = await readdir(worldPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await readFile(join(worldPath, file), "utf-8");
          stories.push(JSON.parse(content) as Story);
        }
      }
    } catch (e) {
      // Skip if not a directory
      continue;
    }
  }

  // Sort by last updated (most recent first)
  return stories.sort((a, b) =>
    new Date(b.metadata.last_updated).getTime() -
    new Date(a.metadata.last_updated).getTime()
  );
}

async function loadStoriesForWorld(worldCheckpoint: string): Promise<Story[]> {
  const worldPath = join(STORIES_DIR, worldCheckpoint);
  if (!existsSync(worldPath)) {
    return [];
  }

  const stories: Story[] = [];
  const files = await readdir(worldPath);

  for (const file of files) {
    if (file.endsWith(".json")) {
      const content = await readFile(join(worldPath, file), "utf-8");
      stories.push(JSON.parse(content) as Story);
    }
  }

  return stories.sort((a, b) =>
    new Date(b.metadata.last_updated).getTime() -
    new Date(a.metadata.last_updated).getTime()
  );
}

async function loadStory(storyId: string): Promise<Story | null> {
  if (!existsSync(STORIES_DIR)) {
    return null;
  }

  const worldDirs = await readdir(STORIES_DIR);

  for (const worldDir of worldDirs) {
    const filePath = join(STORIES_DIR, worldDir, `${storyId}.json`);
    if (existsSync(filePath)) {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as Story;
    }
  }

  return null;
}

// ============================================================================
// File Watching for Live Updates
// ============================================================================

async function startFileWatcher() {
  console.log("Starting file watcher...");

  const watchDirs = [WORLDS_DIR, STORIES_DIR];

  for (const dir of watchDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const watcher = watch(dir, { recursive: true });

      (async () => {
        for await (const event of watcher) {
          console.log(`File change detected: ${event.filename}`);

          // Broadcast reload to all connected clients
          for (const client of clients) {
            client.send(JSON.stringify({ type: "reload" }));
          }
        }
      })();
    } catch (e) {
      console.error(`Failed to watch ${dir}:`, e);
    }
  }
}

// ============================================================================
// Agent Initialization
// ============================================================================

async function initializeSharedAgent() {
  try {
    // Load local project settings (same as CLI does)
    await settingsManager.loadLocalProjectSettings(process.cwd());

    // Get the agent ID that CLI is using
    const localSettings = settingsManager.getLocalProjectSettings(process.cwd());
    sharedAgentId = localSettings?.lastAgent || null;

    if (sharedAgentId) {
      console.log(`📎 Using shared agent: ${sharedAgentId}`);

      // Verify agent exists
      try {
        const client = await getClient();
        const agent = await client.agents.retrieve(sharedAgentId);
        console.log(`   Agent name: ${agent.name}`);
      } catch (error) {
        console.warn(`   Warning: Agent ${sharedAgentId} not found. It may have been deleted.`);
        sharedAgentId = null;
      }
    } else {
      console.log(`ℹ️  No shared agent found. Web UI actions will require CLI to create an agent first.`);
    }
  } catch (error) {
    console.error("Failed to initialize shared agent:", error);
    sharedAgentId = null;
  }
}

// ============================================================================
// Server Setup
// ============================================================================

export async function startCanvasServer() {
  console.log("Starting Story Explorer Canvas Server...");

  // Initialize shared agent from CLI settings
  await initializeSharedAgent();

  // Start file watcher
  startFileWatcher();

  Bun.serve({
    port: PORT,

    routes: {
      "/": indexHtml,

      "/api/worlds": {
        async GET() {
          const worlds = await loadAllWorlds();
          return Response.json(worlds);
        },
      },

      "/api/worlds/:checkpoint": {
        async GET(req) {
          const checkpoint = req.params.checkpoint || "";
          const world = await loadWorld(checkpoint);

          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          return Response.json(world);
        },
      },

      "/api/stories": {
        async GET(req) {
          const url = new URL(req.url);
          const worldCheckpoint = url.searchParams.get("world");

          const stories = worldCheckpoint
            ? await loadStoriesForWorld(worldCheckpoint)
            : await loadAllStories();

          return Response.json(stories);
        },
      },

      "/api/stories/:storyId": {
        async GET(req) {
          const storyId = req.params.storyId || "";
          const story = await loadStory(storyId);

          if (!story) {
            return new Response("Story not found", { status: 404 });
          }

          return Response.json(story);
        },
      },

      "/api/assets/*": {
        async GET(req) {
          const url = new URL(req.url);
          const assetPath = url.pathname.replace("/api/assets/", "");
          const fullPath = join(ASSETS_DIR, assetPath);

          try {
            const file = Bun.file(fullPath);
            const exists = await file.exists();

            if (!exists) {
              return new Response("Asset not found", { status: 404 });
            }

            return new Response(file);
          } catch (error) {
            console.error("Error serving asset:", error);
            return new Response("Error loading asset", { status: 500 });
          }
        },
      },

      "/api/world/:checkpoint/new-story": {
        async POST(req) {
          const checkpoint = req.params.checkpoint || "";

          // Check if shared agent is available
          if (!sharedAgentId) {
            return new Response(
              JSON.stringify({
                error: "No agent available",
                message: "Please create an agent in CLI first (run: ./deep-scifi.js)",
                details: "The canvas server needs a shared agent to create stories.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          // Load the world
          const world = await loadWorld(checkpoint);
          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          try {
            // Get Letta client
            const client = await getClient();

            // Send message to agent
            const userMessage = `Write a new story in the "${checkpoint}" world. Use the world's rules, elements, and constraints. Follow the world's premise: ${world.foundation.core_premise}`;

            // Create message
            const messages = await client.agents.messages.create(sharedAgentId, {
              messages: [
                {
                  role: "user",
                  content: userMessage,
                },
              ],
            });

            // Agent will use story_manager tool to create the story
            return Response.json({
              status: "success",
              message: "Agent is creating a new story...",
              world_checkpoint: checkpoint,
              agent_response: messages,
            });
          } catch (error) {
            console.error("Error invoking agent:", error);
            return new Response(
              JSON.stringify({
                error: "Agent invocation failed",
                message: error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        },
      },

      "/api/world/:checkpoint/develop": {
        async POST(req) {
          const checkpoint = req.params.checkpoint || "";

          // Check if shared agent is available
          if (!sharedAgentId) {
            return new Response(
              JSON.stringify({
                error: "No agent available",
                message: "Please create an agent in CLI first (run: ./deep-scifi.js)",
                details: "The canvas server needs a shared agent to develop worlds.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          // Load the world
          const world = await loadWorld(checkpoint);
          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          try {
            // Get Letta client
            const client = await getClient();

            // Send message to agent
            const userMessage = `Develop the "${checkpoint}" world further. Consider:
- Adding depth to existing rules and elements
- Exploring consequences of the world's mechanisms
- Filling in gaps in technology, culture, or history
- Increasing detail level from ${world.development.state} to more detailed state
- Adding new rules or elements that emerge from existing ones

Current state: ${world.development.state} (v${world.development.version})
Focus areas: ${world.foundation.deep_focus_areas.primary.join(", ")}`;

            // Create message
            const messages = await client.agents.messages.create(sharedAgentId, {
              messages: [
                {
                  role: "user",
                  content: userMessage,
                },
              ],
            });

            // Agent will use world_manager tool to update the world
            return Response.json({
              status: "success",
              message: "Agent is developing the world...",
              world_checkpoint: checkpoint,
              agent_response: messages,
            });
          } catch (error) {
            console.error("Error invoking agent:", error);
            return new Response(
              JSON.stringify({
                error: "Agent invocation failed",
                message: error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        },
      },

      "/api/continue": {
        async POST(req) {
          const body = await req.json() as { story_id?: string; segment_id?: string };
          const { story_id, segment_id } = body;

          if (!story_id) {
            return new Response("story_id is required", { status: 400 });
          }

          // Check if shared agent is available
          if (!sharedAgentId) {
            return new Response(
              JSON.stringify({
                error: "No agent available",
                message: "Please create an agent in CLI first (run: ./deep-scifi.js)",
                details: "The canvas server needs a shared agent to continue stories.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          // Load the story
          const story = await loadStory(story_id);
          if (!story) {
            return new Response("Story not found", { status: 404 });
          }

          // Load the world
          const world = await loadWorld(story.world_checkpoint);
          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          try {
            // Get Letta client
            const client = await getClient();

            // Send message to agent
            const userMessage = `Continue writing story "${story.metadata.title}". Write the next segment, continuing from where the story left off.`;

            // Create message (non-streaming for now, streaming in next step)
            const messages = await client.agents.messages.create(sharedAgentId, {
              messages: [
                {
                  role: "user",
                  content: userMessage,
                },
              ],
            });

            // File watcher will notify web UI when segment is written
            return Response.json({
              status: "success",
              message: "Agent is writing next segment...",
              story_id,
              agent_response: messages,
            });
          } catch (error) {
            console.error("Error invoking agent:", error);
            return new Response(
              JSON.stringify({
                error: "Agent invocation failed",
                message: error instanceof Error ? error.message : "Unknown error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        },
      },

      "/assets/:path": {
        async GET(req) {
          const assetPath = req.params.path || "";
          const file = Bun.file(join(ASSETS_DIR, assetPath));

          if (await file.exists()) {
            return new Response(file);
          }

          return new Response("Asset not found", { status: 404 });
        },
      },
    },

    async fetch(req, server) {
      const url = new URL(req.url);

      // Upgrade to WebSocket for live updates
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      }

      // Handle deep asset paths
      if (url.pathname.startsWith("/assets/")) {
        const assetPath = url.pathname.replace("/assets/", "");
        const file = Bun.file(join(ASSETS_DIR, assetPath));

        if (await file.exists()) {
          return new Response(file);
        }

        return new Response("Asset not found", { status: 404 });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws) {
        console.log("WebSocket client connected");
        clients.add(ws);
      },

      message(ws, message) {
        console.log("Received WebSocket message:", message);
      },

      close(ws) {
        console.log("WebSocket client disconnected");
        clients.delete(ws);
      },
    },

    development: {
      hmr: true,
      console: true,
    },
  });

  console.log(`✨ Story Explorer running at http://localhost:${PORT}`);
  console.log(`📁 Watching: ${WORLDS_DIR}, ${STORIES_DIR}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
}

// Run server if this file is executed directly
if (import.meta.main) {
  await startCanvasServer();
}
