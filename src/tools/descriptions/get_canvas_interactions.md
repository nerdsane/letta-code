Get pending user interactions from the canvas UI.

## When to Use

Call this tool after you've created interactive UI with `canvas_ui` to see if users have interacted with it. Useful for:
- Checking if user clicked "Continue" or a branch option
- Seeing which action they selected from an ActionBar
- Responding to button clicks or other UI events

## Parameters

- `peek` (optional): If true, view interactions without clearing queue
- `componentId` (optional): Filter by specific component
- `interactionType` (optional): Filter by type (e.g., 'click', 'action')

## Response

Returns an array of interactions, each containing:
- `id`: Unique interaction ID
- `timestamp`: When the interaction occurred
- `componentId`: Which component was interacted with
- `interactionType`: Type of interaction ('click', 'action', etc.)
- `target`: Callback target name if specified
- `data`: Interaction payload (e.g., `{ actionId: 'continue' }`)

## Example Flow

```typescript
// 1. Create UI with actions
canvas_ui({
  target: "story",
  mode: "fullscreen",
  spec: {
    type: "ActionBar",
    id: "story-actions",
    props: {
      title: "What next?",
      actions: [
        { id: "continue", label: "Continue", variant: "primary" },
        { id: "explore", label: "Explore world", variant: "branch" }
      ]
    }
  }
})

// 2. Later, check what user clicked
const { interactions } = await get_canvas_interactions()

if (interactions.length > 0) {
  const action = interactions[0]
  if (action.data?.actionId === 'continue') {
    // User wants to continue the story
  } else if (action.data?.actionId === 'explore') {
    // User wants to explore the world
  }
}
```

## Notes

- Interactions expire after 5 minutes
- Queue holds max 100 interactions (oldest removed first)
- Reading clears the queue unless `peek: true`
