/**
 * Story Explorer Gallery Server
 *
 * A web interface for browsing DSF worlds and stories with live updates
 */

import { readdir, readFile, watch } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ServerWebSocket } from "bun";
import type { World, Story } from "../types/dsf";
import indexHtml from "./index.html";

// ============================================================================
// Constants
// ============================================================================

const PORT = 3030;
const WORLDS_DIR = ".dsf/worlds";
const STORIES_DIR = ".dsf/stories";
const ASSETS_DIR = ".dsf/assets";

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
// Server Setup
// ============================================================================

export function startGalleryServer() {
  console.log("Starting Story Explorer Gallery Server...");

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

          // Load the world
          const world = await loadWorld(checkpoint);
          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          // Create context for writing a new story
          const context = {
            action: "write_story",
            world_checkpoint: checkpoint,
            world,
            instructions: `Write a new story in the "${checkpoint}" world. Use the world's rules, elements, and constraints. Follow the world's premise: ${world.foundation.core_premise}`,
          };

          // Save context file
          const contextPath = join(WORLDS_DIR, `_new_story_${checkpoint}_${Date.now()}.json`);
          await Bun.write(contextPath, JSON.stringify(context, null, 2));

          return Response.json({
            status: "success",
            message: "Story context created! Run letta-code to start writing.",
            context_file: contextPath,
            next_steps: [
              "Run: bun run dev (or your letta-code command)",
              `The agent will see the context and start writing a story in the "${checkpoint}" world`,
            ],
          });
        },
      },

      "/api/world/:checkpoint/develop": {
        async POST(req) {
          const checkpoint = req.params.checkpoint || "";

          // Load the world
          const world = await loadWorld(checkpoint);
          if (!world) {
            return new Response("World not found", { status: 404 });
          }

          // Create context for developing the world
          const context = {
            action: "develop_world",
            world_checkpoint: checkpoint,
            world,
            instructions: `Develop the "${checkpoint}" world further. Consider:
- Adding depth to existing rules and elements
- Exploring consequences of the world's mechanisms
- Filling in gaps in technology, culture, or history
- Increasing detail level from ${world.development.state} to more detailed state
- Adding new rules or elements that emerge from existing ones

Current state: ${world.development.state} (v${world.development.version})
Focus areas: ${world.foundation.deep_focus_areas.primary.join(", ")}`,
          };

          // Save context file
          const contextPath = join(WORLDS_DIR, `_develop_${checkpoint}_${Date.now()}.json`);
          await Bun.write(contextPath, JSON.stringify(context, null, 2));

          return Response.json({
            status: "success",
            message: "Development context created! Run letta-code to continue development.",
            context_file: contextPath,
            next_steps: [
              "Run: bun run dev (or your letta-code command)",
              `The agent will see the context and develop the "${checkpoint}" world further`,
            ],
          });
        },
      },

      "/api/continue": {
        async POST(req) {
          const body = await req.json() as { story_id?: string; segment_id?: string };
          const { story_id, segment_id } = body;

          if (!story_id) {
            return new Response("story_id is required", { status: 400 });
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

          // Get the last segment
          const lastSegment = story.segments[story.segments.length - 1];

          // Create continuation context
          const continuationContext = {
            story,
            world,
            last_segment: lastSegment,
            active_endpoints: story.endpoints.filter((e) => e.status === "active"),
            suggested_directions: lastSegment?.branches?.map((b) => b.prompt) || [],
            rules_to_consider: world.foundation.rules.filter((r) => r.certainty !== "tentative"),
            elements_in_play: world.surface.visible_elements,
          };

          // Save continuation context to file
          const contextPath = join(STORIES_DIR, story.world_checkpoint, `_continue_${story_id}.json`);
          await Bun.write(contextPath, JSON.stringify(continuationContext, null, 2));

          return Response.json({
            status: "success",
            message: "Continuation context created. Use this in your next letta-code session to continue the story.",
            context_file: contextPath,
            story_id,
            next_steps: [
              "1. Start letta-code CLI",
              "2. Ask to continue story: " + story.metadata.title,
              "3. The agent will use the continuation context to write the next segment",
            ],
          });
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
  startGalleryServer();
}
