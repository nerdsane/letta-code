/**
 * world_manager - Unified tool for managing DSF worlds
 *
 * Operations:
 * - save: Persist world to filesystem
 * - load: Restore world from checkpoint
 * - diff: Compare two world versions
 * - update: Evolve the world incrementally
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  World,
  WorldDiff,
  UpdateOperation,
  Element,
  Rule,
  Constraint,
  ChangelogEntry,
} from "../../types/dsf";

// ============================================================================
// Tool Interface
// ============================================================================

interface WorldManagerArgs {
  operation: "save" | "load" | "diff" | "update";
  checkpoint_name?: string;
  checkpoint_name_2?: string; // For diff operation
  world?: World; // For save operation
  updates?: UpdateOperation[]; // For update operation
  current_checkpoint?: string; // For update operation (loads, updates, saves)
}

interface WorldManagerResult {
  toolReturn: string;
  status: "success" | "error";
  data?: World | WorldDiff;
}

const WORLDS_DIR = ".dsf/worlds";

// ============================================================================
// Main Entry Point
// ============================================================================

export async function world_manager(
  args: WorldManagerArgs,
): Promise<WorldManagerResult> {
  try {
    // Debug logging
    console.error("world_manager called with args:", JSON.stringify(args, null, 2));

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
      case "save":
        return await saveWorld(args);
      case "load":
        return await loadWorld(args);
      case "diff":
        return await diffWorlds(args);
      case "update":
        return await updateWorld(args);
      default:
        return {
          toolReturn: `Unknown operation: ${args.operation}. Valid operations: save, load, diff, update`,
          status: "error",
        };
    }
  } catch (error) {
    return {
      toolReturn: `Error in world_manager: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    };
  }
}

// ============================================================================
// Operation: Save
// ============================================================================

async function saveWorld(args: WorldManagerArgs): Promise<WorldManagerResult> {
  if (!args.checkpoint_name) {
    return {
      toolReturn: "checkpoint_name is required for save operation",
      status: "error",
    };
  }

  if (!args.world) {
    return {
      toolReturn: "world is required for save operation",
      status: "error",
    };
  }

  // Ensure .dsf/worlds directory exists
  await mkdir(WORLDS_DIR, { recursive: true });

  // Auto-increment version and update timestamp
  const now = new Date().toISOString();
  const worldToSave: World = {
    ...args.world,
    development: {
      ...args.world.development,
      version: args.world.development.version + 1,
      last_modified: now,
    },
  };

  // Add changelog entry if there were revision notes
  if (args.world.development.revision_notes?.length) {
    const changelogEntry: ChangelogEntry = {
      version: worldToSave.development.version,
      timestamp: now,
      changes: args.world.development.revision_notes,
      reason: args.world.development.revision_notes.join("; "),
    };

    worldToSave.changelog = [...(args.world.changelog || []), changelogEntry];
  }

  const filePath = join(WORLDS_DIR, `${args.checkpoint_name}.json`);
  await writeFile(filePath, JSON.stringify(worldToSave, null, 2), "utf-8");

  return {
    toolReturn: `World saved to ${filePath}\nVersion: ${worldToSave.development.version}\nState: ${worldToSave.development.state}`,
    status: "success",
    data: worldToSave,
  };
}

// ============================================================================
// Operation: Load
// ============================================================================

async function loadWorld(args: WorldManagerArgs): Promise<WorldManagerResult> {
  if (!args.checkpoint_name) {
    return {
      toolReturn: "checkpoint_name is required for load operation",
      status: "error",
    };
  }

  const filePath = join(WORLDS_DIR, `${args.checkpoint_name}.json`);

  if (!existsSync(filePath)) {
    return {
      toolReturn: `World checkpoint not found: ${filePath}`,
      status: "error",
    };
  }

  const content = await readFile(filePath, "utf-8");
  const world = JSON.parse(content) as World;

  return {
    toolReturn: `World loaded from ${filePath}\nVersion: ${world.development.version}\nState: ${world.development.state}\nPremise: ${world.foundation.core_premise}`,
    status: "success",
    data: world,
  };
}

// ============================================================================
// Operation: Diff
// ============================================================================

async function diffWorlds(args: WorldManagerArgs): Promise<WorldManagerResult> {
  if (!args.checkpoint_name || !args.checkpoint_name_2) {
    return {
      toolReturn: "Both checkpoint_name and checkpoint_name_2 are required for diff operation",
      status: "error",
    };
  }

  // Load both worlds
  const world1Result = await loadWorld({
    operation: "load",
    checkpoint_name: args.checkpoint_name,
  });
  const world2Result = await loadWorld({
    operation: "load",
    checkpoint_name: args.checkpoint_name_2,
  });

  if (world1Result.status === "error" || world2Result.status === "error") {
    return {
      toolReturn: `Failed to load worlds for diff: ${world1Result.toolReturn} | ${world2Result.toolReturn}`,
      status: "error",
    };
  }

  const world1 = world1Result.data as World;
  const world2 = world2Result.data as World;

  const diff = computeDiff(world1, world2);

  // Format diff as human-readable string
  const summary = formatDiffSummary(diff);

  return {
    toolReturn: summary,
    status: "success",
    data: diff,
  };
}

function computeDiff(world1: World, world2: World): WorldDiff {
  // Elements diff
  const w1Elements = new Map(world1.surface.visible_elements.map((e) => [e.id, e]));
  const w2Elements = new Map(world2.surface.visible_elements.map((e) => [e.id, e]));

  const elementsAdded: Element[] = [];
  const elementsRemoved: string[] = [];
  const elementsModified: { id: string; changes: string[] }[] = [];

  // Find added and modified elements
  for (const [id, elem] of w2Elements) {
    if (!w1Elements.has(id)) {
      elementsAdded.push(elem);
    } else {
      const w1Elem = w1Elements.get(id)!;
      const changes = detectElementChanges(w1Elem, elem);
      if (changes.length > 0) {
        elementsModified.push({ id, changes });
      }
    }
  }

  // Find removed elements
  for (const id of w1Elements.keys()) {
    if (!w2Elements.has(id)) {
      elementsRemoved.push(id);
    }
  }

  // Rules diff
  const w1Rules = new Map(world1.foundation.rules.map((r) => [r.id, r]));
  const w2Rules = new Map(world2.foundation.rules.map((r) => [r.id, r]));

  const rulesAdded: Rule[] = [];
  const rulesRemoved: string[] = [];
  const rulesModified: { id: string; changes: string[] }[] = [];

  for (const [id, rule] of w2Rules) {
    if (!w1Rules.has(id)) {
      rulesAdded.push(rule);
    } else {
      const w1Rule = w1Rules.get(id)!;
      const changes = detectRuleChanges(w1Rule, rule);
      if (changes.length > 0) {
        rulesModified.push({ id, changes });
      }
    }
  }

  for (const id of w1Rules.keys()) {
    if (!w2Rules.has(id)) {
      rulesRemoved.push(id);
    }
  }

  // Constraints diff
  const w1Constraints = new Map(world1.constraints.map((c) => [c.id, c]));
  const w2Constraints = new Map(world2.constraints.map((c) => [c.id, c]));

  const constraintsAdded: Constraint[] = [];
  const constraintsRemoved: string[] = [];

  for (const [id, constraint] of w2Constraints) {
    if (!w1Constraints.has(id)) {
      constraintsAdded.push(constraint);
    }
  }

  for (const id of w1Constraints.keys()) {
    if (!w2Constraints.has(id)) {
      constraintsRemoved.push(id);
    }
  }

  // Depth changes
  const depthChanges: Record<string, { from: "surface" | "medium" | "deep"; to: "surface" | "medium" | "deep" }> = {};
  const w1Depths = world1.foundation.deep_focus_areas.depth_level;
  const w2Depths = world2.foundation.deep_focus_areas.depth_level;

  for (const area in w2Depths) {
    if (w1Depths[area] && w1Depths[area] !== w2Depths[area]) {
      depthChanges[area] = {
        from: w1Depths[area],
        to: w2Depths[area],
      };
    }
  }

  // Changelog entries (new ones only)
  const w1ChangelogCount = world1.changelog?.length || 0;
  const changelogEntries = world2.changelog?.slice(w1ChangelogCount) || [];

  const stateChange: WorldDiff["state_change"] =
    world1.development.state !== world2.development.state
      ? [world1.development.state, world2.development.state]
      : undefined;

  return {
    version_diff: [world1.development.version, world2.development.version],
    timestamp_diff: [world1.development.last_modified, world2.development.last_modified],
    state_change: stateChange,
    elements_added: elementsAdded,
    elements_removed: elementsRemoved,
    elements_modified: elementsModified,
    rules_added: rulesAdded,
    rules_removed: rulesRemoved,
    rules_modified: rulesModified,
    constraints_added: constraintsAdded,
    constraints_removed: constraintsRemoved,
    depth_changes: depthChanges,
    changelog_entries: changelogEntries,
    summary: "", // Will be filled by formatDiffSummary
  };
}

function detectElementChanges(elem1: Element, elem2: Element): string[] {
  const changes: string[] = [];

  if (elem1.description !== elem2.description) {
    changes.push("description changed");
  }
  if (elem1.detail_level !== elem2.detail_level) {
    changes.push(`detail_level: ${elem1.detail_level} → ${elem2.detail_level}`);
  }
  if (elem1.name !== elem2.name) {
    changes.push(`name: ${elem1.name || "(none)"} → ${elem2.name || "(none)"}`);
  }
  if (JSON.stringify(elem1.properties) !== JSON.stringify(elem2.properties)) {
    changes.push("properties modified");
  }

  return changes;
}

function detectRuleChanges(rule1: Rule, rule2: Rule): string[] {
  const changes: string[] = [];

  if (rule1.statement !== rule2.statement) {
    changes.push("statement changed");
  }
  if (rule1.certainty !== rule2.certainty) {
    changes.push(`certainty: ${rule1.certainty} → ${rule2.certainty}`);
  }
  if (rule1.revealed !== rule2.revealed) {
    changes.push(`revealed: ${rule1.revealed} → ${rule2.revealed}`);
  }

  return changes;
}

function formatDiffSummary(diff: WorldDiff): string {
  const lines: string[] = [];

  lines.push(`=== World Diff: v${diff.version_diff[0]} → v${diff.version_diff[1]} ===\n`);

  if (diff.state_change) {
    lines.push(`State: ${diff.state_change[0]} → ${diff.state_change[1]}`);
  }

  if (diff.elements_added.length > 0) {
    lines.push(`\n✓ Elements Added (${diff.elements_added.length}):`);
    for (const elem of diff.elements_added) {
      lines.push(`  - ${elem.type}: ${elem.name || elem.id}`);
    }
  }

  if (diff.elements_removed.length > 0) {
    lines.push(`\n✗ Elements Removed (${diff.elements_removed.length}):`);
    for (const id of diff.elements_removed) {
      lines.push(`  - ${id}`);
    }
  }

  if (diff.elements_modified.length > 0) {
    lines.push(`\n~ Elements Modified (${diff.elements_modified.length}):`);
    for (const mod of diff.elements_modified) {
      lines.push(`  - ${mod.id}: ${mod.changes.join(", ")}`);
    }
  }

  if (diff.rules_added.length > 0) {
    lines.push(`\n✓ Rules Added (${diff.rules_added.length}):`);
    for (const rule of diff.rules_added) {
      lines.push(`  - [${rule.certainty}] ${rule.statement}`);
    }
  }

  if (diff.rules_modified.length > 0) {
    lines.push(`\n~ Rules Modified (${diff.rules_modified.length}):`);
    for (const mod of diff.rules_modified) {
      lines.push(`  - ${mod.id}: ${mod.changes.join(", ")}`);
    }
  }

  if (Object.keys(diff.depth_changes).length > 0) {
    lines.push(`\n↕ Depth Changes:`);
    for (const [area, change] of Object.entries(diff.depth_changes)) {
      lines.push(`  - ${area}: ${change.from} → ${change.to}`);
    }
  }

  if (diff.changelog_entries.length > 0) {
    lines.push(`\n📝 Changelog:`);
    for (const entry of diff.changelog_entries) {
      lines.push(`  v${entry.version}: ${entry.reason}`);
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Operation: Update
// ============================================================================

async function updateWorld(args: WorldManagerArgs): Promise<WorldManagerResult> {
  if (!args.current_checkpoint) {
    return {
      toolReturn: "current_checkpoint is required for update operation",
      status: "error",
    };
  }

  if (!args.updates || args.updates.length === 0) {
    return {
      toolReturn: "updates array is required for update operation",
      status: "error",
    };
  }

  // Load current world
  const loadResult = await loadWorld({
    operation: "load",
    checkpoint_name: args.current_checkpoint,
  });

  if (loadResult.status === "error") {
    return loadResult;
  }

  let world = loadResult.data as World;

  // Apply updates
  const revisionNotes: string[] = [];
  for (const update of args.updates) {
    world = applyUpdate(world, update);
    if (update.reason) {
      revisionNotes.push(update.reason);
    }
  }

  // Add revision notes to world
  world.development.revision_notes = revisionNotes;

  // Save updated world (auto-increments version)
  return await saveWorld({
    operation: "save",
    checkpoint_name: args.current_checkpoint,
    world,
  });
}

function applyUpdate(world: World, update: UpdateOperation): World {
  const path = update.path.split(".");
  const newWorld = JSON.parse(JSON.stringify(world)); // Deep clone

  let current: any = newWorld;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }

  const lastKey = path[path.length - 1];

  switch (update.operation) {
    case "add":
      if (Array.isArray(current[lastKey])) {
        current[lastKey].push(update.value);
      } else {
        current[lastKey] = update.value;
      }
      break;

    case "update":
      current[lastKey] = update.value;
      break;

    case "remove":
      if (Array.isArray(current[lastKey])) {
        // Assume value is the ID to remove
        current[lastKey] = current[lastKey].filter((item: any) => item.id !== update.value);
      } else {
        delete current[lastKey];
      }
      break;
  }

  return newWorld;
}
