Create dynamic, immersive UI experiences in the canvas. Compose magical, game-like interfaces for stories and worlds.

## Proactive Visual Storytelling

As a storyteller, you should **proactively create immersive experiences** without waiting for explicit UI requests:

**When to create fullscreen experiences:**
- When presenting a new story or chapter - wrap it in Hero + ScrollSections
- When revealing a dramatic moment - use Hero with atmospheric background
- When introducing a new world - compose an exploration experience
- When showing character interactions - add inline images and callouts

**When to use inline/overlay:**
- Quick stats or information during conversation
- World rule reminders while writing
- Character relationship visualizations

**Visual immersion is core to storytelling.** Don't just write text - compose experiences that draw the reader in. Generate images for key scenes and weave them into scroll-driven layouts.

## Handling User Interactions

After showing UI with actions, use `get_canvas_interactions` to see what the user selected:

```typescript
// 1. Show experience with actions
canvas_ui({
  mode: "fullscreen",
  spec: {
    type: "Stack",
    children: [
      // ... story content ...
      {
        type: "ActionBar",
        props: {
          actions: [
            { id: "continue", label: "Continue", variant: "primary" },
            { id: "explore", label: "Explore world", variant: "branch" }
          ]
        }
      }
    ]
  }
})

// 2. Later, check what user clicked
const interactions = get_canvas_interactions()
// Returns: [{ componentId: "...", data: { actionId: "continue" } }]

// 3. React to their choice
if (interactions[0]?.data?.actionId === "continue") {
  // Continue the story...
}
```

## Handling Story Read Requests

When user clicks a story in the canvas, you'll receive a `story_read_request` interaction:

```typescript
const interactions = get_canvas_interactions()
// Returns: [{
//   interactionType: "story_read_request",
//   data: {
//     storyId: "story-123",
//     title: "The Awakening",
//     segmentCount: 5,
//     story: { /* full story object */ }
//   }
// }]

// Compose immersive experience for the story
if (interactions[0]?.interactionType === "story_read_request") {
  const { story } = interactions[0].data;

  // Generate a cover image for the story (save_as_asset: true)
  const imageResult = await image_generator({
    prompt: "...",
    save_as_asset: true,
    story_id: story.id
  });
  // imageResult.asset.path will be like "story-123/img_1234.png"

  // Compose fullscreen experience - use /api/assets/ prefix for image URLs
  canvas_ui({
    mode: "fullscreen",
    target: "story-experience",
    spec: {
      type: "Stack",
      children: [
        { type: "ProgressBar", props: { position: "top" } },
        { type: "Hero", props: {
          title: story.metadata.title,
          backgroundImage: `/api/assets/${imageResult.asset.path}`,  // IMPORTANT: /api/assets/ prefix
          badge: "Chapter 1"
        }},
        // Story segments with scroll animations
        ...story.segments.map(segment => ({
          type: "ScrollSection",
          props: { animation: "fade-up" },
          children: [{ type: "Text", props: { content: segment.content } }]
        })),
        // Actions at the end
        { type: "ActionBar", props: {
          actions: [
            { id: "continue", label: "Continue", variant: "primary" },
            { id: "explore", label: "Explore world", variant: "branch" }
          ]
        }}
      ]
    }
  })
}
```

## Parameters

- `target` (required): Mount point where the UI appears
- `spec` (required): Component specification (JSON) defining the UI
- `action` (optional): "create" (default), "update", or "remove"
- `mode` (optional): "overlay" (floating), "fullscreen" (takeover), "inline" (in content)

## Display Modes

### Fullscreen Mode
Takes over the entire viewport for immersive experiences. Use for:
- Story reading experiences
- World exploration
- Character reveals
- Dramatic moments

```typescript
canvas_ui({
  target: "experience",
  mode: "fullscreen",
  spec: {
    type: "Stack",
    children: [
      { type: "Hero", props: { title: "The Awakening", backgroundImage: "..." } },
      { type: "ScrollSection", props: { animation: "fade-up" }, children: [...] }
    ]
  }
})
```

### Overlay Mode (default)
Floating UI at corners, doesn't block content.

### Inline Mode
Appears within story/world content at mount point.

## Experience Components

Use these to create scroll-driven, immersive experiences:

### Hero
Full-viewport introduction with parallax background.

```typescript
{
  type: "Hero",
  props: {
    title: "The Resonance",
    subtitle: "In a world where emotions became visible...",
    backgroundImage: "/api/assets/worlds/resonance/cover.png",
    badge: "Affective Resonance",
    meta: ["Chapter 3", "12 min read"],
    height: "full",  // "full", "large", "medium"
    overlay: "gradient",  // "gradient", "dark", "none"
    showScrollIndicator: true
  }
}
```

### ScrollSection
Content that animates when scrolled into view.

```typescript
{
  type: "ScrollSection",
  props: {
    animation: "fade-up",  // "fade-up", "fade-in", "slide-left", "slide-right", "scale"
    delay: 100,  // milliseconds
    threshold: 0.2  // 0-1, when to trigger
  },
  children: [
    { type: "Text", props: { content: "Story content..." } }
  ]
}
```

### ProgressBar
Reading progress indicator.

```typescript
{
  type: "ProgressBar",
  props: {
    position: "top",  // "top" or "bottom"
    height: 2,
    showLabel: false
  }
}
```

### ActionBar
Action buttons at story/experience end.

```typescript
{
  type: "ActionBar",
  props: {
    title: "What happens next?",
    actions: [
      { id: "continue", label: "Continue the story", variant: "primary" },
      { id: "branch-maya", label: "Follow Maya's path", variant: "branch", description: "She knows something..." }
    ],
    onAction: "handle_story_action"
  }
}
```

## Creating Immersive Story Experiences

When presenting a story, compose an experience:

```typescript
canvas_ui({
  target: "story",
  mode: "fullscreen",
  spec: {
    type: "Stack",
    props: { direction: "vertical" },
    children: [
      // Progress indicator
      { type: "ProgressBar", props: { position: "top" } },

      // Hero opening
      {
        type: "Hero",
        props: {
          title: story.title,
          subtitle: story.opening_line,
          backgroundImage: story.cover_image,
          badge: world.name,
          meta: [`Chapter ${chapter}`, `${readTime} min`],
          height: "full"
        }
      },

      // Story content with scroll animations
      {
        type: "ScrollSection",
        props: { animation: "fade-up" },
        children: [
          { type: "Text", props: { content: paragraph1, variant: "body" } }
        ]
      },

      // Inline image
      {
        type: "ScrollSection",
        props: { animation: "scale" },
        children: [
          { type: "Image", props: { src: scene_image, size: "full", lightbox: true } }
        ]
      },

      // World context callout
      {
        type: "ScrollSection",
        props: { animation: "slide-left" },
        children: [
          { type: "Callout", props: { variant: "rule", title: "World Rule", content: "..." } }
        ]
      },

      // Actions at the end
      {
        type: "ActionBar",
        props: {
          title: "Continue the journey",
          actions: [
            { id: "continue", label: "Continue", variant: "primary" },
            { id: "explore-world", label: "Explore the world", variant: "branch" }
          ]
        }
      }
    ]
  }
})
```

## Primitives

### Image
```typescript
// Use /api/assets/ prefix for saved asset paths
{ type: "Image", props: { src: `/api/assets/${asset.path}`, alt: "Scene description", caption: "The observation deck", size: "full", lightbox: true } }
```

**IMPORTANT: Image URLs must use `/api/assets/` prefix.** When you generate an image with `save_as_asset: true`, the result includes `asset.path` (e.g., `story-123/img_456.png`). Construct the full URL as `/api/assets/${asset.path}`.

### Gallery
```typescript
{ type: "Gallery", props: { images: [{src, alt, caption}], columns: 3, variant: "grid" } }
```

### Card
```typescript
{ type: "Card", props: { title: "...", subtitle: "...", image: "...", variant: "elevated" } }
```

### Timeline
```typescript
{
  type: "Timeline",
  props: {
    events: [
      { title: "Discovery", date: "2087", description: "...", status: "completed" }
    ],
    orientation: "vertical"
  }
}
```

### Callout
```typescript
{ type: "Callout", props: { variant: "rule", title: "World Rule", content: "In 2087..." } }
// variants: "info", "warning", "quote", "rule", "tech"
```

### Stats
```typescript
{
  type: "Stats",
  props: {
    items: [
      { value: "12", label: "Characters" },
      { value: "8", label: "Locations" }
    ],
    columns: 4
  }
}
```

### Badge
```typescript
{ type: "Badge", props: { label: "Active", variant: "cyan" } }
```

### Divider
```typescript
{ type: "Divider", props: { variant: "accent", spacing: "lg" } }
```

### Layout: Stack & Grid
```typescript
{ type: "Stack", props: { direction: "vertical", spacing: "lg" }, children: [...] }
{ type: "Grid", props: { columns: 3, gap: "md" }, children: [...] }
```

## Interaction Handling

Components can specify interaction handlers:

```typescript
{
  type: "ActionBar",
  id: "story-actions",
  props: {
    onAction: "story_action_handler",  // Callback name
    actions: [...]
  }
}
```

When user clicks, the interaction flows back to you via Agent Bus.

## Design Guidelines

1. **Use fullscreen mode** for story reading and world exploration
2. **Add Hero** at the start of every experience
3. **Wrap content in ScrollSection** for scroll-triggered animations
4. **Use ProgressBar** for long reading experiences
5. **End with ActionBar** to guide user's next action
6. **Stagger animation delays** for visual flow (0, 100, 200ms...)
7. **Use Callout** to surface world rules and context
8. **Keep text readable** - use body variant, not too long

## DSF Brand

- Colors: teal `#00ffcc`, cyan `#00ffff` only
- No rounded corners
- No purple, no bright white
- Monospace fonts for headers
- Subtle glows and animations

## RawJsx - Wildcard Component

For maximum flexibility, use `RawJsx` to render **any React component**. You write the JSX code directly.

```typescript
{
  "type": "RawJsx",
  "props": {
    "jsx": "() => { const [count, setCount] = useState(0); return <div style={{ color: colors.teal, padding: '2rem' }}><button style={styles.button} onClick={() => setCount(c => c + 1)}>Clicked {count} times</button></div>; }"
  }
}
```

### Available in Scope

- **React hooks**: `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`, `memo`
- **DSF utilities**:
  - `colors`: `{ teal, cyan, bg, bgSecondary, textPrimary, textSecondary, textTertiary, borderSubtle, borderMedium }`
  - `styles`: `{ card, heading, text, button, glow(color) }`
  - `DSF`: Full DSF object with colors and styles

### Example: Custom Interactive Chart

```typescript
{
  "type": "RawJsx",
  "props": {
    "jsx": "() => { const [active, setActive] = useState(0); const data = [34, 67, 23, 89, 45]; return <div style={{ padding: '2rem', background: colors.bgSecondary }}><div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '100px' }}>{data.map((v, i) => <div key={i} onClick={() => setActive(i)} style={{ width: '40px', height: v + '%', background: i === active ? colors.teal : colors.borderMedium, cursor: 'pointer', transition: 'all 0.2s' }} />)}</div><p style={styles.text}>Value: {data[active]}</p></div>; }"
  }
}
```

### Example: Custom Story Reveal Animation

```typescript
{
  "type": "RawJsx",
  "props": {
    "jsx": "() => { const [revealed, setRevealed] = useState(false); return <div style={{ padding: '3rem', textAlign: 'center' }}><h2 style={{ ...styles.heading, opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(20px)', transition: 'all 0.8s ease' }}>The Truth Was Hidden</h2><button style={styles.button} onClick={() => setRevealed(true)}>{revealed ? 'Continue...' : 'Reveal'}</button></div>; }"
  }
}
```

### When to Use RawJsx

Use `RawJsx` when you need:
- Custom interactive visualizations
- Animations not covered by built-in components
- Novel UI patterns for storytelling
- Experimental layouts

**Prefer typed components** (Hero, ScrollSection, etc.) for standard patterns - they're more reliable and consistent. Use RawJsx for the unique, creative moments that need custom behavior.
