/**
 * image_generator - Generate images using AI models (OpenAI DALL-E or Google Gemini/Imagen)
 *
 * Generates images from text prompts and optionally saves them as assets.
 */

import type { StoryAsset } from "../../types/dsf";
import { asset_manager } from "./asset_manager";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  model?: string; // For Google: "gemini-2.0-flash-exp", "imagen-3.0-generate-001", etc.
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

const DEFAULT_PROVIDER: ImageProvider = "openai";
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
    console.error("image_generator called with args:", JSON.stringify(args, null, 2));

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

    const provider = args.provider || DEFAULT_PROVIDER;

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
    if (imageUrl.startsWith('data:')) {
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
      toolReturn += "\n\nTo save this image, use the asset_manager tool or set save_as_asset: true";
    }

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
// OpenAI DALL-E Generation
// ============================================================================

async function generateWithOpenAI(
  args: ImageGeneratorArgs,
): Promise<{ imageUrl: string; revisedPrompt?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  const size = args.size || DEFAULT_SIZE;
  const quality = args.quality || DEFAULT_QUALITY;
  const style = args.style || DEFAULT_STYLE;

  // DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792
  // DALL-E 2 supports 256x256, 512x512, 1024x1024
  const model = size === "256x256" || size === "512x512" ? "dall-e-2" : "dall-e-3";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: args.prompt,
      n: 1,
      size,
      quality: model === "dall-e-3" ? quality : undefined,
      style: model === "dall-e-3" ? style : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ url: string; revised_prompt?: string }>;
  };

  if (!data.data || data.data.length === 0) {
    throw new Error("No image returned from OpenAI");
  }

  return {
    imageUrl: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
  };
}

// ============================================================================
// Google Gemini/Imagen Generation
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

  // Default to Gemini 2.0 Flash (Nano Banana) - fastest and free
  const modelName = args.model || "gemini-2.0-flash-exp";

  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  const numberOfImages = args.number_of_images || 1;

  // Generate image
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
      responseModalities: ["image"],
      maxOutputTokens: 8192,
    },
  });

  const response = result.response;

  // Extract image data
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No image generated by Google");
  }

  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error("No image data in response");
  }

  // Find the inline data part with image
  const imagePart = candidate.content.parts.find((part: any) => part.inlineData?.mimeType?.startsWith("image/"));

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

  const asset: StoryAsset = {
    id: assetId,
    type: "image",
    path: args.asset_path || fileName,
    description: args.asset_description || `Generated image: ${args.prompt.slice(0, 100)}`,
    generated: true,
    prompt: args.prompt,
  };

  // Save using asset_manager
  const result = await asset_manager({
    operation: "save",
    story_id: args.story_id,
    world_checkpoint: args.world_checkpoint,
    asset,
    data: dataUrl,
  });

  if (result.status === "error") {
    throw new Error(`Failed to save asset: ${result.toolReturn}`);
  }

  return asset;
}
