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
    backgroundImage: "/assets/worlds/resonance/cover.png",
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
{ type: "Image", props: { src: "...", alt: "...", caption: "...", size: "full", lightbox: true } }
```

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
