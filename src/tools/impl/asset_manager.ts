/**
 * asset_manager - Manage multimedia assets for DSF stories
 *
 * Operations:
 * - save: Store asset file
 * - load: Retrieve asset
 * - list: Get all assets
 * - delete: Remove asset
 */

import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  StoryAsset,
  AssetManagerArgs,
  AssetManagerResult,
} from "../../types/dsf";

// ============================================================================
// Constants
// ============================================================================

const ASSETS_DIR = ".dsf/assets";

// ============================================================================
// Main Entry Point
// ============================================================================

export async function asset_manager(
  args: AssetManagerArgs,
): Promise<AssetManagerResult> {
  try {
    console.error("asset_manager called with args:", JSON.stringify(args, null, 2));

    if (!args || typeof args !== 'object') {
      return {
        toolReturn: `Invalid arguments: expected object, got ${typeof args}`,
        status: "error",
      };
    }

    if (!args.operation) {
      return {
        toolReturn: `Missing required parameter: operation`,
        status: "error",
      };
    }

    switch (args.operation) {
      case "save":
        return await saveAsset(args);
      case "load":
        return await loadAsset(args);
      case "list":
        return await listAssets(args);
      case "delete":
        return await deleteAsset(args);
      default:
        return {
          toolReturn: `Unknown operation: ${args.operation}. Valid operations: save, load, list, delete`,
          status: "error",
        };
    }
  } catch (error) {
    return {
      toolReturn: `Error in asset_manager: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    };
  }
}

// ============================================================================
// Operation: Save Asset
// ============================================================================

async function saveAsset(args: AssetManagerArgs): Promise<AssetManagerResult> {
  if (!args.asset) {
    return {
      toolReturn: "asset is required for save operation",
      status: "error",
    };
  }

  if (!args.data) {
    return {
      toolReturn: "data is required for save operation (base64 or file path)",
      status: "error",
    };
  }

  // Ensure assets directory exists
  await mkdir(ASSETS_DIR, { recursive: true });

  // Determine asset path based on story_id or world_checkpoint
  let assetPath: string;
  if (args.story_id) {
    const storyDir = join(ASSETS_DIR, args.story_id);
    await mkdir(storyDir, { recursive: true });
    assetPath = join(storyDir, args.asset.path);
  } else if (args.world_checkpoint) {
    const worldDir = join(ASSETS_DIR, "worlds", args.world_checkpoint);
    await mkdir(worldDir, { recursive: true });
    assetPath = join(worldDir, args.asset.path);
  } else {
    // Use path directly - it may include subdirectories (e.g., "story_id/img.png")
    assetPath = join(ASSETS_DIR, args.asset.path);
    // Ensure parent directory exists (handles paths like "story_id/img.png")
    const parentDir = join(assetPath, "..");
    await mkdir(parentDir, { recursive: true });
  }

  // Handle data - could be base64 or file path
  let fileData: Buffer;

  if (args.data.startsWith("data:")) {
    // Base64 data URL
    const base64Data = args.data.split(",")[1] || "";
    fileData = Buffer.from(base64Data, "base64");
  } else if (args.data.startsWith("/") || args.data.startsWith("./")) {
    // File path - copy file
    fileData = await readFile(args.data);
  } else {
    // Assume raw base64
    fileData = Buffer.from(args.data, "base64");
  }

  await writeFile(assetPath, fileData);

  return {
    toolReturn: `Asset saved: ${args.asset.id}\nType: ${args.asset.type}\nPath: ${assetPath}\nSize: ${fileData.length} bytes`,
    status: "success",
    data: args.asset,
  };
}

// ============================================================================
// Operation: Load Asset
// ============================================================================

async function loadAsset(args: AssetManagerArgs): Promise<AssetManagerResult> {
  if (!args.asset_id && !args.asset) {
    return {
      toolReturn: "asset_id or asset is required for load operation",
      status: "error",
    };
  }

  const assetPath = args.asset
    ? join(ASSETS_DIR, args.asset.path)
    : await findAssetPath(args.asset_id!);

  if (!assetPath || !existsSync(assetPath)) {
    return {
      toolReturn: `Asset not found: ${args.asset_id || args.asset?.path}`,
      status: "error",
    };
  }

  const data = await readFile(assetPath);
  const base64 = data.toString("base64");

  // If we have asset metadata, return it
  if (args.asset) {
    return {
      toolReturn: `Asset loaded: ${args.asset.id}\nSize: ${data.length} bytes`,
      status: "success",
      data: {
        ...args.asset,
        // Could add data field if needed
      },
    };
  }

  // Otherwise return basic info
  return {
    toolReturn: `Asset loaded from ${assetPath}\nSize: ${data.length} bytes`,
    status: "success",
  };
}

// ============================================================================
// Operation: List Assets
// ============================================================================

async function listAssets(args: AssetManagerArgs): Promise<AssetManagerResult> {
  if (!existsSync(ASSETS_DIR)) {
    return {
      toolReturn: "No assets found (assets directory doesn't exist yet)",
      status: "success",
      data: [],
    };
  }

  const assets: string[] = [];

  // If story_id specified, list only assets for that story
  if (args.story_id) {
    const storyDir = join(ASSETS_DIR, args.story_id);
    if (existsSync(storyDir)) {
      const files = await readdir(storyDir);
      assets.push(...files.map(f => join(args.story_id!, f)));
    }
  } else if (args.world_checkpoint) {
    // List assets for this specific world
    const worldDir = join(ASSETS_DIR, "worlds", args.world_checkpoint);
    if (existsSync(worldDir)) {
      const files = await readdir(worldDir);
      assets.push(...files.map(f => join("worlds", args.world_checkpoint!, f)));
    }
  } else {
    // List all assets
    const files = await readdir(ASSETS_DIR, { recursive: true });
    assets.push(...files.filter(f => typeof f === 'string') as string[]);
  }

  const summary = assets.length > 0
    ? `Found ${assets.length} assets:\n${assets.map(a => `  - ${a}`).join("\n")}`
    : "No assets found";

  return {
    toolReturn: summary,
    status: "success",
    data: assets as any, // Would need to return proper StoryAsset objects
  };
}

// ============================================================================
// Operation: Delete Asset
// ============================================================================

async function deleteAsset(args: AssetManagerArgs): Promise<AssetManagerResult> {
  if (!args.asset_id && !args.asset) {
    return {
      toolReturn: "asset_id or asset is required for delete operation",
      status: "error",
    };
  }

  const assetPath = args.asset
    ? join(ASSETS_DIR, args.asset.path)
    : await findAssetPath(args.asset_id!);

  if (!assetPath || !existsSync(assetPath)) {
    return {
      toolReturn: `Asset not found: ${args.asset_id || args.asset?.path}`,
      status: "error",
    };
  }

  await unlink(assetPath);

  return {
    toolReturn: `Asset deleted: ${assetPath}`,
    status: "success",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function findAssetPath(assetId: string): Promise<string | null> {
  if (!existsSync(ASSETS_DIR)) {
    return null;
  }

  // Try to find asset by ID
  // This is a simple implementation - could be more sophisticated
  const files = await readdir(ASSETS_DIR, { recursive: true });

  for (const file of files) {
    if (typeof file === 'string' && file.includes(assetId)) {
      return join(ASSETS_DIR, file);
    }
  }

  return null;
}
