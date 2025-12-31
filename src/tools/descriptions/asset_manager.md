Manages multimedia assets for DSF stories: save images, audio, video, and documents.

## Operations

### save
Store an asset file to the filesystem.

```typescript
asset_manager({
  operation: "save",
  story_id: "the_first_contact",
  asset: {
    id: "asset_001",
    type: "image",
    path: "landing_site.png",  // Will be stored in .dsf/assets/the_first_contact/landing_site.png
    description: "Alien landing site at dawn",
    generated: true,
    prompt: "A misty alien landscape with bioluminescent plants at dawn"
  },
  data: "data:image/png;base64,iVBORw0KG..."  // Base64 data URL, raw base64, or file path
})
```

- Creates asset directory if needed
- Organizes assets by story_id (optional)
- Accepts data as base64 string, data URL, or file path
- Returns asset metadata with file info

### load
Retrieve an asset from storage.

```typescript
// By asset metadata
asset_manager({
  operation: "load",
  asset: {
    id: "asset_001",
    type: "image",
    path: "the_first_contact/landing_site.png"
  }
})

// By asset ID (searches for file)
asset_manager({
  operation: "load",
  asset_id: "asset_001"
})
```

Returns asset data (as base64) and metadata.

### list
Get all assets, optionally filtered by story or world.

```typescript
// List all assets
asset_manager({
  operation: "list"
})

// List assets for a specific story
asset_manager({
  operation: "list",
  story_id: "the_first_contact"
})

// List assets for a world
asset_manager({
  operation: "list",
  world_checkpoint: "my_world"
})
```

Returns list of asset paths.

### delete
Remove an asset from storage.

```typescript
asset_manager({
  operation: "delete",
  asset_id: "asset_001"
})
```

Permanently deletes the asset file.

## Asset Structure

Assets are stored in `.dsf/assets/` with optional organization by story:

```
.dsf/
  assets/
    {story_id}/
      landing_site.png
      theme_music.mp3
      concept_art.jpg
    shared/
      logo.png
```

## Asset Types

- **image**: PNG, JPG, GIF, WebP, SVG
- **audio**: MP3, WAV, OGG
- **video**: MP4, WebM
- **document**: PDF, TXT, MD

## Integration with story_manager

Assets are referenced in story segments:

```typescript
story_manager({
  operation: "save_segment",
  story_id: "my_story",
  segment: {
    content: "The ship descended...",
    word_count: 850,
    parent_segment: null,
    world_evolution: { ... },
    assets: [
      {
        id: "asset_001",
        type: "image",
        path: "my_story/ship_descent.png",
        description: "The ship entering atmosphere"
      }
    ]
  }
})
```

The story segment stores asset metadata, while asset_manager handles the actual file storage and retrieval.

## Workflow Example

```typescript
// 1. Generate or receive asset data
const imageData = "data:image/png;base64,iVBORw0KG...";

// 2. Save asset
asset_manager({
  operation: "save",
  story_id: "neural_canvas",
  asset: {
    id: "studio_interior",
    type: "image",
    path: "studio.png",
    description: "Nia's neural art studio",
    generated: true,
    prompt: "A high-tech art studio with neural interface equipment"
  },
  data: imageData
})

// 3. Reference asset in story segment
story_manager({
  operation: "save_segment",
  story_id: "neural_canvas",
  segment: {
    content: "Nia entered her studio...",
    word_count: 500,
    parent_segment: null,
    world_evolution: { ... },
    assets: [
      {
        id: "studio_interior",
        type: "image",
        path: "neural_canvas/studio.png",
        description: "Nia's neural art studio"
      }
    ]
  }
})

// 4. Asset is now viewable in Story Explorer UI
```

## Usage Notes

- Assets are organized by story for better management
- Supports both AI-generated and user-provided assets
- Asset metadata (description, prompt) helps with context
- Gallery UI automatically displays assets inline with story segments
- Use descriptive file names for better organization
- Large assets should be compressed before saving

## AI Image Generation Integration

For AI-generated images:

```typescript
// 1. Generate prompt based on story context
const prompt = "A cyberpunk city street with neon signs and rain, cinematic lighting";

// 2. Call image generation API (e.g., DALL-E, Midjourney)
const imageUrl = await generateImage(prompt);

// 3. Download and convert to base64
const imageData = await fetchAsBase64(imageUrl);

// 4. Save with generation metadata
asset_manager({
  operation: "save",
  story_id: "cyberpunk_story",
  asset: {
    id: "city_street_01",
    type: "image",
    path: "city_street.png",
    description: "Neon-lit city street in the rain",
    generated: true,
    prompt: prompt
  },
  data: imageData
})
```

Storing the generation prompt allows regenerating or iterating on the image later.
