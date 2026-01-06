/**
 * story_manager - Unified tool for managing DSF stories
 *
 * Operations:
 * - create: Start a new story in a world
 * - save_segment: Add a story segment
 * - load: Restore story from storage
 * - list: Get all stories (optionally filtered by world)
 * - branch: Create story branch from segment
 * - continue: Get continuation context for agent
 * - update_metadata: Update story metadata
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Story,
  StorySegment,
  StoryBranch,
  StoryEndpoint,
  StoryManagerArgs,
  StoryManagerResult,
  ContinuationContext,
  World,
  WorldContributions,
} from "../../types/dsf";
import { world_manager } from "./world_manager";

// ============================================================================
// Constants
// ============================================================================

const STORIES_DIR = ".dsf/stories";
const ASSETS_DIR = ".dsf/assets";

// ============================================================================
// Main Entry Point
// ============================================================================

export async function story_manager(
  args: StoryManagerArgs,
): Promise<StoryManagerResult> {
  try {
    console.error("story_manager called with args:", JSON.stringify(args, null, 2));

    if (!args || typeof args !== 'object') {
      return {
        toolReturn: `Invalid arguments: expected object, got ${typeof args}`,
        status: "error",
      };
    }

    if (!args.operation) {
      return {
        toolReturn: `Missing required parameter: operation. Received args: ${JSON.stringify(Object.keys(args))}`,
        status: "error",
      };
    }

    switch (args.operation) {
      case "create":
        return await createStory(args);
      case "save_segment":
        return await saveSegment(args);
      case "load":
        return await loadStory(args);
      case "list":
        return await listStories(args);
      case "branch":
        return await createBranch(args);
      case "continue":
        return await getContinuationContext(args);
      case "update_metadata":
        return await updateMetadata(args);
      default:
        return {
          toolReturn: `Unknown operation: ${args.operation}. Valid operations: create, save_segment, load, list, branch, continue, update_metadata`,
          status: "error",
        };
    }
  } catch (error) {
    return {
      toolReturn: `Error in story_manager: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    };
  }
}

// ============================================================================
// Operation: Create Story
// ============================================================================

async function createStory(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.world_checkpoint) {
    return {
      toolReturn: "world_checkpoint is required for create operation",
      status: "error",
    };
  }

  if (!args.title) {
    return {
      toolReturn: "title is required for create operation",
      status: "error",
    };
  }

  // Load world to get version
  const worldResult = await world_manager({
    operation: "load",
    checkpoint_name: args.world_checkpoint,
  });

  if (worldResult.status === "error") {
    return {
      toolReturn: `Failed to load world: ${worldResult.toolReturn}`,
      status: "error",
    };
  }

  const world = worldResult.data as World;

  // Generate story ID from title
  const storyId = generateId(args.title);
  const now = new Date().toISOString();

  const story: Story = {
    id: storyId,
    world_checkpoint: args.world_checkpoint,
    world_version: world.development.version,
    metadata: {
      title: args.title,
      created: now,
      last_updated: now,
      status: "active",
      tags: [],
    },
    segments: [],
    endpoints: [],
    world_contributions: {
      characters_developed: [],
      locations_explored: [],
      rules_tested: [],
      new_rules_discovered: [],
      contradictions_found: [],
      themes_explored: [],
    },
  };

  // Ensure directory exists
  const worldDir = join(STORIES_DIR, args.world_checkpoint);
  await mkdir(worldDir, { recursive: true });

  // Save story
  const filePath = join(worldDir, `${storyId}.json`);
  await writeFile(filePath, JSON.stringify(story, null, 2), "utf-8");

  return {
    toolReturn: `Story created: ${args.title}\nID: ${storyId}\nWorld: ${args.world_checkpoint} (v${world.development.version})\nPath: ${filePath}`,
    status: "success",
    data: story,
  };
}

// ============================================================================
// Operation: Save Segment
// ============================================================================

async function saveSegment(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.story_id) {
    return {
      toolReturn: "story_id is required for save_segment operation",
      status: "error",
    };
  }

  if (!args.segment) {
    return {
      toolReturn: "segment is required for save_segment operation",
      status: "error",
    };
  }

  // Load story
  const loadResult = await loadStory({ operation: "load", story_id: args.story_id });
  if (loadResult.status === "error") {
    return loadResult;
  }

  const story = loadResult.data as Story;
  const now = new Date().toISOString();

  // Create segment with ID
  const segmentId = `seg_${String(story.segments.length + 1).padStart(3, "0")}`;
  const segment: StorySegment = {
    id: segmentId,
    created: now,
    ...args.segment,
  };

  // Add segment to story
  story.segments.push(segment);
  story.metadata.last_updated = now;

  // Update endpoints
  updateEndpoints(story, segment);

  // Update world contributions
  updateWorldContributions(story, segment);

  // Save story
  const worldDir = join(STORIES_DIR, story.world_checkpoint);
  const filePath = join(worldDir, `${story.id}.json`);
  await writeFile(filePath, JSON.stringify(story, null, 2), "utf-8");

  return {
    toolReturn: `Segment saved to story "${story.metadata.title}"\nSegment ID: ${segmentId}\nWord count: ${segment.word_count}\nTotal segments: ${story.segments.length}`,
    status: "success",
    data: segment,
  };
}

// ============================================================================
// Operation: Load Story
// ============================================================================

async function loadStory(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.story_id) {
    return {
      toolReturn: "story_id is required for load operation",
      status: "error",
    };
  }

  // Find story file across all world directories
  const storyFile = await findStoryFile(args.story_id);
  if (!storyFile) {
    return {
      toolReturn: `Story not found: ${args.story_id}`,
      status: "error",
    };
  }

  const content = await readFile(storyFile, "utf-8");
  const story = JSON.parse(content) as Story;

  return {
    toolReturn: `Story loaded: "${story.metadata.title}"\nWorld: ${story.world_checkpoint} (v${story.world_version})\nSegments: ${story.segments.length}\nStatus: ${story.metadata.status}`,
    status: "success",
    data: story,
  };
}

// ============================================================================
// Operation: List Stories
// ============================================================================

async function listStories(args: StoryManagerArgs): Promise<StoryManagerResult> {
  const stories: Story[] = [];

  if (!existsSync(STORIES_DIR)) {
    return {
      toolReturn: "No stories found (stories directory doesn't exist yet)",
      status: "success",
      data: [],
    };
  }

  // If world_checkpoint specified, only list stories for that world
  if (args.world_checkpoint) {
    const worldDir = join(STORIES_DIR, args.world_checkpoint);
    if (existsSync(worldDir)) {
      const files = await readdir(worldDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await readFile(join(worldDir, file), "utf-8");
          stories.push(JSON.parse(content) as Story);
        }
      }
    }
  } else {
    // List all stories across all worlds
    const worldDirs = await readdir(STORIES_DIR);
    for (const worldDir of worldDirs) {
      const worldPath = join(STORIES_DIR, worldDir);
      const stat = await readFile(worldPath).catch(() => null);
      if (!stat) continue;

      const files = await readdir(worldPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await readFile(join(worldPath, file), "utf-8");
          stories.push(JSON.parse(content) as Story);
        }
      }
    }
  }

  // Format output
  const summary = stories.map(s =>
    `- ${s.metadata.title} (${s.id})\n  World: ${s.world_checkpoint}, Segments: ${s.segments.length}, Status: ${s.metadata.status}`
  ).join("\n");

  return {
    toolReturn: `Found ${stories.length} stories:\n${summary}`,
    status: "success",
    data: stories,
  };
}

// ============================================================================
// Operation: Create Branch
// ============================================================================

async function createBranch(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.story_id) {
    return {
      toolReturn: "story_id is required for branch operation",
      status: "error",
    };
  }

  if (!args.branch) {
    return {
      toolReturn: "branch is required for branch operation",
      status: "error",
    };
  }

  // Load story
  const loadResult = await loadStory({ operation: "load", story_id: args.story_id });
  if (loadResult.status === "error") {
    return loadResult;
  }

  const story = loadResult.data as Story;

  // Find the last segment (or specified segment)
  const lastSegment = story.segments[story.segments.length - 1];
  if (!lastSegment) {
    return {
      toolReturn: "Cannot create branch: story has no segments yet",
      status: "error",
    };
  }

  // Create branch
  const branchId = `branch_${String((lastSegment.branches?.length || 0) + 1).padStart(2, "0")}`;
  const branch: StoryBranch = {
    id: branchId,
    ...args.branch,
  };

  // Add branch to last segment
  if (!lastSegment.branches) {
    lastSegment.branches = [];
  }
  lastSegment.branches.push(branch);

  // Update endpoints
  const endpoint: StoryEndpoint = {
    segment_id: lastSegment.id,
    branch_id: branchId,
    status: "pending",
  };
  story.endpoints.push(endpoint);

  // Save story
  const worldDir = join(STORIES_DIR, story.world_checkpoint);
  const filePath = join(worldDir, `${story.id}.json`);
  await writeFile(filePath, JSON.stringify(story, null, 2), "utf-8");

  return {
    toolReturn: `Branch created in story "${story.metadata.title}"\nBranch ID: ${branchId}\nPrompt: ${branch.prompt}\nSegment: ${lastSegment.id}`,
    status: "success",
    data: story,
  };
}

// ============================================================================
// Operation: Get Continuation Context
// ============================================================================

async function getContinuationContext(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.story_id) {
    return {
      toolReturn: "story_id is required for continue operation",
      status: "error",
    };
  }

  // Load story
  const loadResult = await loadStory({ operation: "load", story_id: args.story_id });
  if (loadResult.status === "error") {
    return loadResult;
  }

  const story = loadResult.data as Story;

  // Load world
  const worldResult = await world_manager({
    operation: "load",
    checkpoint_name: story.world_checkpoint,
  });

  if (worldResult.status === "error") {
    return {
      toolReturn: `Failed to load world: ${worldResult.toolReturn}`,
      status: "error",
    };
  }

  const world = worldResult.data as World;

  // Get last segment
  const lastSegment = story.segments[story.segments.length - 1];
  if (!lastSegment) {
    return {
      toolReturn: "Cannot continue: story has no segments yet. Use save_segment to add the first segment.",
      status: "error",
    };
  }

  // Get active endpoints
  const activeEndpoints = story.endpoints.filter(ep => ep.status === "active" || ep.status === "pending");

  // Gather rules that have been applied
  const appliedRuleIds = new Set<string>();
  for (const segment of story.segments) {
    segment.world_evolution?.rules_applied?.forEach(id => appliedRuleIds.add(id));
  }
  const rulesInPlay = world.foundation.rules.filter(r => appliedRuleIds.has(r.id));

  // Gather elements that have been introduced
  const introducedElementIds = new Set<string>();
  for (const segment of story.segments) {
    segment.world_evolution?.elements_introduced?.forEach(id => introducedElementIds.add(id));
  }
  const elementsInPlay = world.surface.visible_elements.filter(e => introducedElementIds.has(e.id));

  // Suggest directions
  const suggestedDirections: string[] = [];

  // From branches
  if (lastSegment.branches && lastSegment.branches.length > 0) {
    lastSegment.branches.forEach(b => {
      if (b.status === "pending") {
        suggestedDirections.push(`Branch: ${b.prompt}`);
      }
    });
  }

  // From world questions
  if (lastSegment.world_evolution.new_questions && lastSegment.world_evolution.new_questions.length > 0) {
    suggestedDirections.push(`Explore questions: ${lastSegment.world_evolution.new_questions.join(", ")}`);
  }

  // From unused rules
  const unusedRules = world.foundation.rules.filter(r => !appliedRuleIds.has(r.id));
  if (unusedRules.length > 0) {
    suggestedDirections.push(`Test rules: ${unusedRules.slice(0, 3).map(r => r.id).join(", ")}`);
  }

  const context: ContinuationContext = {
    story,
    world,
    last_segment: lastSegment,
    active_endpoints: activeEndpoints,
    suggested_directions: suggestedDirections,
    rules_to_consider: rulesInPlay,
    elements_in_play: elementsInPlay,
  };

  return {
    toolReturn: `Continuation context for "${story.metadata.title}"\n\nLast segment: ${lastSegment.id} (${lastSegment.word_count} words)\nActive endpoints: ${activeEndpoints.length}\nSuggested directions:\n${suggestedDirections.map(d => `  - ${d}`).join("\n")}\n\nRules in play: ${rulesInPlay.length}\nElements in play: ${elementsInPlay.length}`,
    status: "success",
    data: context,
  };
}

// ============================================================================
// Operation: Update Metadata
// ============================================================================

async function updateMetadata(args: StoryManagerArgs): Promise<StoryManagerResult> {
  if (!args.story_id) {
    return {
      toolReturn: "story_id is required for update_metadata operation",
      status: "error",
    };
  }

  if (!args.metadata) {
    return {
      toolReturn: "metadata is required for update_metadata operation",
      status: "error",
    };
  }

  // Load story
  const loadResult = await loadStory({ operation: "load", story_id: args.story_id });
  if (loadResult.status === "error") {
    return loadResult;
  }

  const story = loadResult.data as Story;

  // Update metadata
  story.metadata = {
    ...story.metadata,
    ...args.metadata,
    last_updated: new Date().toISOString(),
  };

  // Save story
  const worldDir = join(STORIES_DIR, story.world_checkpoint);
  const filePath = join(worldDir, `${story.id}.json`);
  await writeFile(filePath, JSON.stringify(story, null, 2), "utf-8");

  return {
    toolReturn: `Metadata updated for story "${story.metadata.title}"\nStatus: ${story.metadata.status}`,
    status: "success",
    data: story,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

async function findStoryFile(storyId: string): Promise<string | null> {
  if (!existsSync(STORIES_DIR)) {
    return null;
  }

  const worldDirs = await readdir(STORIES_DIR);
  for (const worldDir of worldDirs) {
    const filePath = join(STORIES_DIR, worldDir, `${storyId}.json`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

function updateEndpoints(story: Story, newSegment: StorySegment): void {
  // Remove endpoint for parent segment (if any)
  if (newSegment.parent_segment) {
    story.endpoints = story.endpoints.filter(ep => ep.segment_id !== newSegment.parent_segment);
  }

  // Add endpoint for new segment
  if (newSegment.branches && newSegment.branches.length > 0) {
    // If segment has branches, create endpoints for each branch
    for (const branch of newSegment.branches) {
      story.endpoints.push({
        segment_id: newSegment.id,
        branch_id: branch.id,
        status: "pending",
      });
    }
  } else {
    // No branches, create single endpoint
    story.endpoints.push({
      segment_id: newSegment.id,
      status: "active",
    });
  }
}

function updateWorldContributions(story: Story, segment: StorySegment): void {
  const contrib = story.world_contributions;

  // Add new elements (guard against missing world_evolution)
  if (segment.world_evolution?.elements_introduced) {
    for (const elemId of segment.world_evolution.elements_introduced) {
      if (!contrib.characters_developed.includes(elemId) && !contrib.locations_explored.includes(elemId)) {
        // Assume character for now (could be smarter)
        contrib.characters_developed.push(elemId);
      }
    }
  }

  // Add applied rules (guard against missing world_evolution)
  if (segment.world_evolution?.rules_applied) {
    for (const ruleId of segment.world_evolution.rules_applied) {
      if (!contrib.rules_tested.includes(ruleId)) {
        contrib.rules_tested.push(ruleId);
      }
    }
  }
}
