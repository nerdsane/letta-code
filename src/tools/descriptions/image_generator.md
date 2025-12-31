Generates images from text prompts using AI models and optionally saves them as story assets.

## Providers

### OpenAI DALL-E (Default)
- **DALL-E 3**: High quality, best prompt understanding, automatic prompt enhancement
- **DALL-E 2**: Smaller sizes (256x256, 512x512), faster, cheaper
- **Cost**: ~$0.040/image (DALL-E 3 standard), ~$0.080/image (DALL-E 3 HD)
- **Requires**: `OPENAI_API_KEY` environment variable

### Google Gemini/Imagen (Nano Banana)
- **Gemini 2.0 Flash**: Fast, free tier available, aka "Nano Banana"
- **Imagen 3/4**: High quality, photorealistic
- **Cost**: Free tier available, then pay-per-use
- **Requires**: `GOOGLE_API_KEY` or `GEMINI_API_KEY` environment variable
- **Get key**: https://aistudio.google.com/apikey

## Basic Usage

**⚠️ IMPORTANT: Always use `save_as_asset: true` for story/world images!**
OpenAI URLs expire in 1 hour, so images must be saved as assets to be permanent.

### Generate and Save as Asset (Recommended)

```typescript
image_generator({
  prompt: "A cyberpunk city street at night, neon signs reflecting in puddles, rain",
  save_as_asset: true,
  story_id: "my_story",
  asset_id: "city_street_night",
  asset_description: "The city street where the protagonist first arrives"
})
```

Downloads the image and saves it to `.dsf/assets/my_story/city_street_night.png`, then returns asset metadata to include in your story segment.

### Quick Preview (URL only, expires in 1 hour)

```typescript
image_generator({
  prompt: "A futuristic art studio with neural interface equipment, soft blue lighting, cinematic"
})
```

Returns temporary image URL. For Google, image is returned as base64 data URL immediately. For OpenAI, URL expires in 1 hour.

## Advanced Options

### High Quality DALL-E 3

```typescript
image_generator({
  prompt: "Portrait of a neural artist, detailed face, studio lighting, professional photography",
  provider: "openai",
  size: "1024x1024",
  quality: "hd",
  style: "natural"
})
```

### Google Gemini (Nano Banana)

```typescript
image_generator({
  prompt: "Abstract visualization of consciousness, flowing data streams, ethereal glow",
  provider: "google",
  model: "gemini-2.0-flash-exp"
})
```

### Wide Format

```typescript
image_generator({
  prompt: "Panoramic view of a sprawling space station orbiting Earth",
  size: "1792x1024",  // Wide landscape
  save_as_asset: true,
  story_id: "space_story",
  asset_description: "Orbital station exterior view"
})
```

## Organizational Parameters

When saving images as assets, you can organize them by story or world:

### For Story Assets (use `story_id`)

```typescript
image_generator({
  prompt: "A dimly lit studio with neural interface equipment",
  save_as_asset: true,
  story_id: "neural_canvas",
  asset_id: "studio_scene"
})
```

Saves to: `.dsf/assets/neural_canvas/studio_scene.png`

### For World Assets (use `world_checkpoint`)

```typescript
image_generator({
  prompt: "Watercolor illustration of a Brooklyn warehouse art studio",
  save_as_asset: true,
  world_checkpoint: "affective_resonance",
  asset_id: "cover"
})
```

Saves to: `.dsf/assets/worlds/affective_resonance/cover.png`

**When to use which:**
- `story_id`: Assets that belong to a specific story
- `world_checkpoint`: Assets that belong to a world (like cover images)
- Neither: Flat structure in `.dsf/assets/`

### Custom Paths (use `asset_path`)

```typescript
image_generator({
  prompt: "Character portrait",
  save_as_asset: true,
  story_id: "my_story",
  asset_path: "characters/protagonist.png"  // Nested path within story
})
```

Saves to: `.dsf/assets/my_story/characters/protagonist.png`

**Note:** Don't include the organizational prefix (story_id/world_checkpoint) in `asset_path` - it's added automatically.

## Integration with Stories

### Workflow

1. **Write story segment** with description of scene
2. **Generate image** based on scene description
3. **Save as asset** with same story_id
4. **Reference asset** in story segment metadata

### Example

```typescript
// 1. Generate and save image
const result = await image_generator({
  prompt: "A dimly lit neural art studio, monitors glowing with abstract patterns, artist wearing interface headset",
  save_as_asset: true,
  story_id: "neural_canvas",
  asset_id: "nia_studio_interior",
  asset_description: "Nia's studio during a creative session"
});

// 2. Use the asset in story segment
await story_manager({
  operation: "save_segment",
  story_id: "neural_canvas",
  segment: {
    content: "The studio hummed with quiet energy as Nia prepared for another session...",
    word_count: 500,
    parent_segment: null,
    world_evolution: { ... },
    assets: [
      {
        id: "nia_studio_interior",
        type: "image",
        path: "neural_canvas/nia_studio_interior.png",
        description: "Nia's studio during a creative session",
        generated: true,
        prompt: "A dimly lit neural art studio, monitors glowing with abstract patterns, artist wearing interface headset"
      }
    ]
  }
});
```

The image will now display inline with the story segment in the Story Explorer gallery.

## Prompt Engineering Tips

### For Story Illustrations

- **Be specific about mood and atmosphere**: "melancholic", "tense", "serene"
- **Specify lighting**: "golden hour", "harsh fluorescent", "moonlight"
- **Include style references**: "cinematic", "like a Blade Runner scene", "studio photography"
- **Mention composition**: "close-up", "wide shot", "bird's eye view"

### Good Prompts

✅ "A neural interface artist in her studio, surrounded by holographic displays showing abstract emotional patterns, soft blue lighting, contemplative mood, cinematic composition"

✅ "First-person view of wearing a neural interface headset, seeing through it to a workspace with glowing AI-generated art, near-future aesthetic, cool color palette"

### Avoid

❌ "art studio" (too generic)
❌ "person working" (not specific enough)

## Configuration

Set environment variables in `.env`:

```bash
# Required for OpenAI (default provider)
OPENAI_API_KEY=sk-...

# Optional: For Google Gemini/Imagen (Nano Banana)
GOOGLE_API_KEY=AIza...
# Or alternatively:
GEMINI_API_KEY=AIza...
```

## Cost Optimization

**OpenAI:**
- Use `quality: "standard"` instead of `"hd"` (50% cheaper)
- Use smaller sizes when possible
- Use DALL-E 2 for quick iterations (`size: "512x512"`)

**Google:**
- Gemini 2.0 Flash has generous free tier
- Only charged for actual usage
- Free for experimentation and low-volume use

## Error Handling

Common errors:
- `OPENAI_API_KEY not set`: Add API key to `.env`
- `GOOGLE_API_KEY not set`: Add API key or switch to OpenAI provider
- `Content policy violation`: Prompt violates safety guidelines, rephrase
- `No image data found`: API returned unexpected format, try again
- `Image generation failed`: Service issue, retry

## Limitations

- **OpenAI URLs expire in 1 hour** - always save important images as assets
- **Google returns base64 directly** - no expiration but larger response
- **Content policies apply** - both providers filter inappropriate content
- **Size limits**: DALL-E 3 max 1792x1024, Google varies by model
- **Rate limits**: Depend on your API tier and usage
