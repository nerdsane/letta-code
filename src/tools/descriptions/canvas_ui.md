Create dynamic UI components in the canvas for inline visualizations and interactive elements.

Allows agents to create contextual UI that appears exactly where it's relevant within stories and worlds, not just as floating overlays.

## Parameters

- `target` (required): Mount point where the UI component should appear
- `spec` (required): Component specification (JSON object) defining the UI to render
- `action` (optional): Action to perform - "create" (default), "update", or "remove"

## Available Mount Points

### Story Mount Points
- **`story_header`**: After story metadata, before first segment - for timelines, metadata dashboards
- **`story_segment_{id}_before`**: Immediately before segment text - for content warnings, scene setting
- **`story_segment_{id}`**: Immediately after segment text - for character analysis, visualizations
- **`story_footer`**: At end of story after all segments - for continue buttons, completion summary

### World Mount Points
- **`world_header`**: After world premise, before world details - for world controls, metadata
- **`world_overview`**: After action message, before story list - for statistics, character directory

### Special Mount Points
- **`floating`**: Fixed overlay at bottom-right corner - for persistent controls, chat interface

## Available Components

### Dialog
Modal dialog with trigger button. Great for detailed information without cluttering the main view.

```typescript
{
  type: "Dialog",
  id: "story-timeline",
  props: {
    title: "Story Timeline",
    description: "Key events in chronological order",
    trigger: {
      type: "Button",
      props: { label: "📊 View Timeline", variant: "primary" }
    }
  },
  children: {
    type: "Stack",
    props: { spacing: 16 },
    children: [
      { type: "Text", props: { content: "Chapter 1: Discovery", variant: "heading" } }
    ]
  }
}
```

### Button
Action button with primary/secondary variants.

```typescript
{
  type: "Button",
  id: "continue-story",
  props: {
    label: "Continue Story",
    variant: "primary"  // or "secondary"
  }
}
```

### Text
Styled text with multiple variants and sizes.

```typescript
{
  type: "Text",
  id: "character-note",
  props: {
    content: "Alice and Bob have met before",
    variant: "body",  // "heading", "body", or "caption"
    size: "md",       // "sm", "md", or "lg"
    color: "var(--neon-cyan)"  // Optional CSS color
  }
}
```

### Stack
Layout container for arranging multiple components.

```typescript
{
  type: "Stack",
  id: "character-relationships",
  props: {
    direction: "vertical",  // or "horizontal"
    spacing: 16  // pixels between items
  },
  children: [
    { type: "Text", props: { content: "Alice → knows → Bob", variant: "body" } },
    { type: "Text", props: { content: "Bob → trusts → Carol", variant: "body" } }
  ]
}
```

## Usage Examples

### Create Story Timeline
```typescript
canvas_ui({
  target: "story_header",
  spec: {
    type: "Dialog",
    id: "timeline-viz",
    props: {
      title: "Story Timeline",
      description: "Visual timeline of key events",
      trigger: {
        type: "Button",
        props: { label: "View Timeline", variant: "primary" }
      }
    },
    children: {
      type: "Stack",
      props: { spacing: 20 },
      children: [
        { type: "Text", props: { content: "Event 1: Discovery", variant: "heading" } },
        { type: "Text", props: { content: "Event 2: Conflict", variant: "heading" } }
      ]
    }
  }
})
```

### Add Inline Visualization
```typescript
canvas_ui({
  target: "story_segment_abc123",
  spec: {
    type: "Stack",
    id: "relationship-viz",
    props: { direction: "horizontal", spacing: 12 },
    children: [
      { type: "Text", props: { content: "🕸️ Character Network", variant: "caption" } },
      { type: "Button", props: { label: "Expand", variant: "secondary" } }
    ]
  }
})
```

### Create World Statistics
```typescript
canvas_ui({
  target: "world_overview",
  spec: {
    type: "Stack",
    id: "world-stats",
    props: { direction: "vertical", spacing: 16 },
    children: [
      {
        type: "Text",
        props: {
          content: "🌍 World Statistics",
          variant: "heading",
          size: "lg",
          color: "var(--neon-cyan)"
        }
      },
      {
        type: "Stack",
        props: { direction: "horizontal", spacing: 24 },
        children: [
          { type: "Text", props: { content: "📖 Stories: 3", variant: "body" } },
          { type: "Text", props: { content: "👥 Characters: 12", variant: "body" } },
          { type: "Text", props: { content: "🗺️ Locations: 8", variant: "body" } }
        ]
      }
    ]
  }
})
```

### Update Existing Component
```typescript
canvas_ui({
  target: "story_header",
  spec: {
    id: "timeline-viz",
    props: { title: "Updated Timeline" }
  },
  action: "update"
})
```

### Remove Component
```typescript
canvas_ui({
  target: "story_footer",
  spec: { id: "continue-button" },
  action: "remove"
})
```

## Design Patterns

### Progressive Disclosure
Use dialogs for detailed information that doesn't clutter the main view:
```typescript
{
  type: "Dialog",
  props: {
    title: "Detailed Analysis",
    trigger: { type: "Button", props: { label: "Show Details" } }
  },
  children: { /* detailed content */ }
}
```

### Contextual Actions
Place action buttons near relevant content:
```typescript
canvas_ui({
  target: "story_segment_123",
  spec: {
    type: "Stack",
    props: { direction: "horizontal" },
    children: [
      { type: "Button", props: { label: "Analyze Scene" } },
      { type: "Button", props: { label: "Generate Image" } }
    ]
  }
})
```

### Status Indicators
Show information without requiring interaction:
```typescript
{
  type: "Text",
  props: {
    content: "✨ AI-enhanced segment",
    variant: "caption",
    color: "var(--neon-cyan)"
  }
}
```

## Usage Notes

- **Agent Bus Required**: canvas_ui requires the Agent Bus server running on port 8284
- **Canvas Required**: The canvas UI must be running on port 3030
- **Component IDs**: Include an `id` in your spec to identify components for updates/removal
- **Multiple Components**: Multiple components can be mounted at the same target
- **Layout**: Mount points stack components vertically by default with 16px spacing
- **Styling**: Use CSS variables like `var(--neon-cyan)` and `var(--neon-magenta)` for colors
- **Interactions**: User interactions (clicks, changes) flow back to the agent (work in progress)

## Architecture

```
Agent → canvas_ui() → Agent Bus (WS) → Canvas UI → Renders at mount point
```

All DSF UI infrastructure (Agent Bus, Canvas, Mount Points) is part of letta-code, making canvas_ui a DSF-specific tool.
