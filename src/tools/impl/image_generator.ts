/**
 * image_generator - Generate images using AI models (Google Gemini or OpenAI GPT-Image)
 *
 * Generates images from text prompts and optionally saves them as assets.
 *
 * Default Provider Selection:
 * - Google (preferred): Uses gemini-3-pro-image-preview (Nano Banana Pro) if GOOGLE_API_KEY is set
 * - OpenAI (fallback): Uses gpt-image-1.5 (latest, Dec 2025) via /v1/images/generations if OPENAI_API_KEY is set
 *
 * At least one API key must be configured for image generation to work.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StoryAsset } from "../../types/dsf";
import { asset_manager } from "./asset_manager";
import { broadcastStateChange } from "./canvas_ui";

// ============================================================================
// Types
// ============================================================================

export type ImageProvider = "openai" | "google";

export interface ImageGeneratorArgs {
  prompt: string;
  provider?: ImageProvider;
  size?: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  model?: string; // OpenAI: "gpt-image-1.5" (default, latest), "gpt-image-1", "dall-e-3" | Google: "gemini-3-pro-image-preview" (default, aka Nano Banana Pro)
  save_as_asset?: boolean;
  story_id?: string;
  world_checkpoint?: string;
  asset_id?: string;
  asset_path?: string; // Custom path within organizational root (optional)
  asset_description?: string;
  number_of_images?: number; // For Google: 1-4, default 1
}

export interface ImageGeneratorResult {
  toolReturn: string;
  status: "success" | "error";
  image_url?: string;
  revised_prompt?: string;
  asset?: StoryAsset;
}

// ============================================================================
// Configuration
// ============================================================================

// Auto-detect default provider: prefer Google (Nano Banana Pro) if key is available
function getDefaultProvider(): ImageProvider {
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Prefer Google (Nano Banana Pro) over OpenAI
  if (googleKey) {
    return "google";
  } else if (openaiKey) {
    return "openai";
  }

  // No keys available - will error when called
  return "openai"; // Default to openai for backwards compatibility
}

const DEFAULT_SIZE = "1024x1024";
const DEFAULT_QUALITY = "standard";
const DEFAULT_STYLE = "vivid";

// ============================================================================
// Main Entry Point
// ============================================================================

export async function image_generator(
  args: ImageGeneratorArgs,
): Promise<ImageGeneratorResult> {
  try {
    console.error(
      "image_generator called with args:",
      JSON.stringify(args, null, 2),
    );

    if (!args || typeof args !== "object") {
      return {
        toolReturn: `Invalid arguments: expected object, got ${typeof args}`,
        status: "error",
      };
    }

    if (!args.prompt) {
      return {
        toolReturn: "prompt is required",
        status: "error",
      };
    }

    // Validate that at least one image generation API key is available
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!googleKey && !openaiKey) {
      return {
        toolReturn:
          "No image generation API keys configured. Set either GOOGLE_API_KEY (preferred) or OPENAI_API_KEY in your .env file.",
        status: "error",
      };
    }

    const provider = args.provider || getDefaultProvider();

    // Broadcast that image generation is starting (for loading indicator)
    if (args.world_checkpoint) {
      await broadcastStateChange("image_generating", {
        worldId: args.world_checkpoint,
        storyId: args.story_id,
      });
    }

    // Generate image based on provider
    let imageUrl: string;
    let revisedPrompt: string | undefined;

    switch (provider) {
      case "openai":
        ({ imageUrl, revisedPrompt } = await generateWithOpenAI(args));
        break;
      case "google":
        ({ imageUrl } = await generateWithGoogle(args));
        break;
      default:
        return {
          toolReturn: `Unknown provider: ${provider}. Valid providers: openai, google`,
          status: "error",
        };
    }

    let toolReturn = `Image generated successfully!\nProvider: ${provider}\nPrompt: ${args.prompt}`;
    if (revisedPrompt) {
      toolReturn += `\nRevised prompt: ${revisedPrompt}`;
    }

    // Don't dump base64 data into chat - just indicate the type
    if (imageUrl.startsWith("data:")) {
      toolReturn += `\nImage: base64 data (${Math.round(imageUrl.length / 1024)}KB)`;
    } else {
      toolReturn += `\nImage URL: ${imageUrl}`;
    }

    // Optionally save as asset
    let asset: StoryAsset | undefined;
    if (args.save_as_asset) {
      asset = await saveAsAsset(imageUrl, args);
      toolReturn += `\n\nSaved as asset: ${asset.id}\nPath: ${asset.path}`;
    } else {
      toolReturn +=
        "\n\nTo save this image, use the asset_manager tool or set save_as_asset: true";
    }

    // Broadcast state change for reactive UI
    // Send assetUrl (not assetPath) to match frontend expectations
    await broadcastStateChange("image_generated", {
      assetId: asset?.id,
      assetUrl: asset?.path ? `/api/assets/${asset.path}` : undefined,
      storyId: args.story_id,
      worldId: args.world_checkpoint,
    });

    return {
      toolReturn,
      status: "success",
      image_url: imageUrl,
      revised_prompt: revisedPrompt,
      asset,
    };
  } catch (error) {
    return {
      toolReturn: `Error generating image: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    };
  }
}

// ============================================================================
// OpenAI GPT-Image-1 Generation
// ============================================================================

async function generateWithOpenAI(
  args: ImageGeneratorArgs,
): Promise<{ imageUrl: string; revisedPrompt?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  // Map size to gpt-image-1 supported sizes
  // gpt-image-1 supports: "1024x1024", "1024x1536" (portrait), "1536x1024" (landscape), "auto"
  let size: string = args.size || DEFAULT_SIZE;
  if (size === "1792x1024") {
    size = "1536x1024"; // Map to closest supported landscape
  } else if (size === "1024x1792") {
    size = "1024x1536"; // Map to closest supported portrait
  } else if (size === "512x512" || size === "256x256") {
    size = "1024x1024"; // gpt-image-1 doesn't support smaller sizes
  }

  // Use gpt-image-1.5 (latest, Dec 2025) - best quality, 4x faster, better text rendering
  // Falls back to gpt-image-1 or dall-e-3 if specified
  const model = args.model || "gpt-image-1.5";

  // Build request body
  // gpt-image-1 and gpt-image-1.5 ONLY return b64_json (don't pass response_format - it's implied)
  // DALL-E models support response_format, quality, and style parameters
  const requestBody: Record<string, any> = {
    model,
    prompt: args.prompt,
    n: 1,
    size,
  };

  // Only add response_format for DALL-E models (gpt-image-1/1.5 don't accept this param)
  if (model.startsWith("dall-e")) {
    requestBody.response_format = "b64_json";
    requestBody.quality = args.quality || DEFAULT_QUALITY;
    requestBody.style = args.style || DEFAULT_STYLE;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{
      b64_json?: string;
      url?: string;
      revised_prompt?: string;
    }>;
  };

  if (!data.data || data.data.length === 0) {
    throw new Error("No image returned from OpenAI");
  }

  const imageData = data.data[0];
  if (!imageData) {
    throw new Error("No image data returned from OpenAI");
  }

  let imageUrl: string;
  if (imageData.b64_json) {
    imageUrl = `data:image/png;base64,${imageData.b64_json}`;
  } else if (imageData.url) {
    // Fetch the image and convert to base64
    const imgResponse = await fetch(imageData.url);
    const imgBuffer = await imgResponse.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    imageUrl = `data:image/png;base64,${base64}`;
  } else {
    throw new Error("No image data in response");
  }

  return {
    imageUrl,
    revisedPrompt: imageData.revised_prompt,
  };
}

// ============================================================================
// Google Gemini Generation (Nano Banana Pro)
// ============================================================================

async function generateWithGoogle(
  args: ImageGeneratorArgs,
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set. Get one at https://aistudio.google.com/apikey",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Default to Gemini 3 Pro Image (Nano Banana Pro) - latest and best
  // Also known as "Nano Banana Pro" - highest quality image generation model
  const modelName = args.model || "gemini-3-pro-image-preview";

  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  const _numberOfImages = args.number_of_images || 1;

  // Generate image with proper responseModalities config
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: args.prompt,
          },
        ],
      },
    ],
    generationConfig: {
      // IMPORTANT: Must specify both TEXT and IMAGE for Nano Banana
      responseModalities: ["TEXT", "IMAGE"],
      maxOutputTokens: 8192,
    } as any,
  });

  const response = result.response;

  // Extract image data
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No image generated by Google");
  }

  const candidate = response.candidates[0];
  if (
    !candidate ||
    !candidate.content ||
    !candidate.content.parts ||
    candidate.content.parts.length === 0
  ) {
    throw new Error("No image data in response");
  }

  // Find the inline data part with image
  const imagePart = candidate.content.parts.find((part: any) =>
    part.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart || !imagePart.inlineData) {
    throw new Error("No image data found in response");
  }

  // Google returns base64 directly
  const base64Data = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType || "image/png";

  // Create data URL
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  return {
    imageUrl: dataUrl,
  };
}

// ============================================================================
// Save as Asset
// ============================================================================

async function saveAsAsset(
  imageUrl: string,
  args: ImageGeneratorArgs,
): Promise<StoryAsset> {
  // Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Data = Buffer.from(imageBuffer).toString("base64");
  const dataUrl = `data:image/png;base64,${base64Data}`;

  // Generate asset metadata
  const assetId = args.asset_id || `img_${Date.now()}`;
  const fileName = `${assetId}.png`;

  // Calculate full path including story_id or world_checkpoint context
  // This ensures the path in metadata matches where asset_manager saves the file
  let fullPath: string;
  if (args.asset_path) {
    // Custom path provided - use as-is but add context prefix if needed
    if (args.story_id) {
      fullPath = `${args.story_id}/${args.asset_path}`;
    } else if (args.world_checkpoint) {
      fullPath = `worlds/${args.world_checkpoint}/${args.asset_path}`;
    } else {
      fullPath = args.asset_path;
    }
  } else {
    // Auto-generate path with context
    if (args.story_id) {
      fullPath = `${args.story_id}/${fileName}`;
    } else if (args.world_checkpoint) {
      fullPath = `worlds/${args.world_checkpoint}/${fileName}`;
    } else {
      fullPath = fileName;
    }
  }

  const asset: StoryAsset = {
    id: assetId,
    type: "image",
    path: fullPath,
    description:
      args.asset_description || `Generated image: ${args.prompt.slice(0, 100)}`,
    generated: true,
    prompt: args.prompt,
  };

  // Save using asset_manager
  // Note: Don't pass story_id/world_checkpoint since fullPath already includes the context
  // This prevents asset_manager from double-prefixing the path
  const result = await asset_manager({
    operation: "save",
    asset,
    data: dataUrl,
  });

  if (result.status === "error") {
    throw new Error(`Failed to save asset: ${result.toolReturn}`);
  }

  return asset;
}
