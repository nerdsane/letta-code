/**
 * image_generator - Generate images using AI models (Google Gemini or OpenAI GPT-Image)
 *
 * Generates images from text prompts and optionally saves them as assets.
 * 
 * Default Provider Selection:
 * - Google (preferred): Uses gemini-3-pro-image-preview (Nano Banana Pro) if GOOGLE_API_KEY is set
 * - OpenAI (fallback): Uses gpt-image-1.5 via GPT-5.2 Responses API if OPENAI_API_KEY is set
 * 
 * At least one API key must be configured for image generation to work.
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
  model?: string; // OpenAI: "gpt-image-1.5" (default), "gpt-image-1", "gpt-image-1-mini" | Google: "gemini-3-pro-image-preview" (default, aka Nano Banana Pro)
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

    // Validate that at least one image generation API key is available
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!googleKey && !openaiKey) {
      return {
        toolReturn: "No image generation API keys configured. Set either GOOGLE_API_KEY (preferred) or OPENAI_API_KEY in your .env file.",
        status: "error",
      };
    }

    const provider = args.provider || getDefaultProvider();

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
// OpenAI GPT-Image Generation (New Responses API)
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
  
  // Use gpt-image models via the Responses API
  // Default to gpt-image-1.5 (latest and best), but allow override via args.model
  const imageModel = args.model || "gpt-image-1.5";
  
  // GPT-5.2 or GPT-5 orchestrates the image generation
  const mainlineModel = "gpt-5.2";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: mainlineModel,
      input: args.prompt,
      tools: [
        {
          type: "image_generation",
          size: size,
          quality: quality === "hd" ? "high" : quality === "standard" ? "medium" : "auto",
          format: "png",
          background: "auto",
        },
      ],
      tool_choice: { type: "image_generation" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json() as {
    output: Array<{
      type: string;
      result?: string;
      revised_prompt?: string;
    }>;
  };

  // Find the image generation call in the output
  const imageGenCall = data.output.find(
    (item) => item.type === "image_generation_call"
  );

  if (!imageGenCall || !imageGenCall.result) {
    throw new Error("No image returned from OpenAI");
  }

  // Result is base64 encoded
  const base64Data = imageGenCall.result;
  const dataUrl = `data:image/png;base64,${base64Data}`;

  return {
    imageUrl: dataUrl,
    revisedPrompt: imageGenCall.revised_prompt,
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

  const numberOfImages = args.number_of_images || 1;

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
