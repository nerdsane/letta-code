Manages DSF (Deep Sci-Fi) stories: create, continue, branch, and track how stories evolve worlds.

## Operations

### create
Start a new story in a world.

```typescript
story_manager({
  operation: "create",
  world_checkpoint: "my_world",
  title: "The First Contact"
})
```

- Creates a new story linked to a world
- Generates story ID from title
- Records world version
- Initializes empty segments and endpoints
- Saves to `.dsf/stories/{world_checkpoint}/{story_id}.json`

### save_segment
Add a story segment (continuation or branch).

```typescript
story_manager({
  operation: "save_segment",
  story_id: "the_first_contact",
  segment: {
    content: "The ship descended through the atmosphere...",
    word_count: 850,
    parent_segment: "seg_001",  // or null for first segment
    world_evolution: {
      elements_introduced: ["char_captain", "loc_landing_site"],
      rules_applied: ["rule_1", "rule_3"],
      rules_challenged: [],
      new_questions: ["How do aliens perceive time?"],
      world_changes: ["First contact protocols established"]
    },
    assets: [
      {
        id: "asset_001",
        type: "image",
        path: "the_first_contact/landing_site.png",
        description: "The alien landing site at dawn"
      }
    ],
    branches: [
      {
        id: "branch_a",
        prompt: "Captain accepts the alien invitation",
        status: "pending"
      },
      {
        id: "branch_b",
        prompt: "Captain returns to ship for consultation",
        status: "pending"
      }
    ]
  }
})
```

- Adds segment to story
- Auto-generates segment ID
- Updates story endpoints
- Tracks world contributions
- Updates last_modified timestamp

### load
Restore a story from storage.

```typescript
story_manager({
  operation: "load",
  story_id: "the_first_contact"
})
```

Returns the complete story object with all segments and metadata.

### list
Get all stories, optionally filtered by world.

```typescript
// List all stories
story_manager({
  operation: "list"
})

// List stories for a specific world
story_manager({
  operation: "list",
  world_checkpoint: "my_world"
})
```

Returns array of stories with summary info.

### branch
Create a story branch from the last segment.

```typescript
story_manager({
  operation: "branch",
  story_id: "the_first_contact",
  branch: {
    prompt: "An alternate timeline where the captain refuses contact",
    status: "pending"
  }
})
```

- Adds branch to the last segment
- Creates new endpoint
- Branch can be written as a new segment later

### continue
Get continuation context for writing the next segment.

```typescript
story_manager({
  operation: "continue",
  story_id: "the_first_contact"
})
```

Returns rich context including:
- Full story and world data
- Last segment
- Active endpoints
- Suggested directions (branches, questions, unused rules)
- Rules in play
- Elements introduced so far

Use this before writing the next segment to understand the story state.

### update_metadata
Update story metadata (title, status, tags, notes).

```typescript
story_manager({
  operation: "update_metadata",
  story_id: "the_first_contact",
  metadata: {
    status: "completed",
    tags: ["first-contact", "hard-sf", "character-driven"],
    author_notes: "This story explores the theme of communication barriers"
  }
})
```

- Updates only the specified metadata fields
- Auto-updates last_modified timestamp

## Story Structure

Stories follow a segment-based model that supports:
- **Linear narratives**: Each segment follows from the previous
- **Branching narratives**: Segments can have multiple possible continuations
- **World evolution tracking**: Each segment records how it affects the world
- **Multimedia integration**: Segments can have associated assets

### Complete Story Example

```typescript
{
  id: "the_first_contact",
  world_checkpoint: "my_world",
  world_version: 3,

  metadata: {
    title: "The First Contact",
    created: "2025-12-30T18:00:00Z",
    last_updated: "2025-12-30T20:30:00Z",
    status: "active",
    tags: ["first-contact", "hard-sf"],
    author_notes: "Exploring communication barriers"
  },

  segments: [
    {
      id: "seg_001",
      content: "The ship descended through the atmosphere...",
      word_count: 850,
      created: "2025-12-30T18:00:00Z",
      parent_segment: null,  // First segment

      world_evolution: {
        elements_introduced: ["char_captain", "loc_landing_site"],
        rules_applied: ["rule_1"],
        new_questions: ["How do aliens perceive time?"]
      },

      assets: [
        {
          id: "asset_001",
          type: "image",
          path: "the_first_contact/landing_site.png",
          description: "Alien landing site"
        }
      ]
    },
    {
      id: "seg_002",
      content: "The captain stepped onto alien soil...",
      word_count: 650,
      created: "2025-12-30T19:30:00Z",
      parent_segment: "seg_001",

      world_evolution: {
        rules_applied: ["rule_1", "rule_3"],
        rules_challenged: ["rule_2"]
      },

      branches: [
        {
          id: "branch_a",
          prompt: "Accept alien invitation",
          status: "active"
        },
        {
          id: "branch_b",
          prompt: "Return to ship",
          status: "pending"
        }
      ]
    }
  ],

  endpoints: [
    {
      segment_id: "seg_002",
      branch_id: "branch_a",
      status: "active"
    },
    {
      segment_id: "seg_002",
      branch_id: "branch_b",
      status: "pending"
    }
  ],

  world_contributions: {
    characters_developed: ["char_captain"],
    locations_explored: ["loc_landing_site"],
    rules_tested: ["rule_1", "rule_3"],
    new_rules_discovered: [],
    contradictions_found: [],
    themes_explored: ["communication", "first-contact"]
  }
}
```

## Usage Notes

- Stories are always linked to a specific world checkpoint
- Each segment tracks its contribution to world evolution
- Use `continue` operation to get context before writing next segment
- Branches allow exploring alternative story paths
- World contributions accumulate across all segments
- Endpoints track where the story can continue

## Integration with world_manager

Stories and worlds evolve together:
1. Create a world with `world_manager`
2. Start a story with `story_manager.create`
3. Write segments that apply/test world rules
4. If story reveals new worldbuilding, update world with `world_manager.update`
5. Continue the story with new context from evolved world
6. Use `world_manager.diff` to see how the world changed through storytelling

## Workflow Example

```typescript
// 1. Create story
story_manager({
  operation: "create",
  world_checkpoint: "neural_art_2035",
  title: "The Neural Canvas"
})

// 2. Write first segment
story_manager({
  operation: "save_segment",
  story_id: "the_neural_canvas",
  segment: {
    content: "Nia adjusted her neural interface...",
    word_count: 800,
    parent_segment: null,
    world_evolution: {
      elements_introduced: ["char_nia"],
      rules_applied: ["rule_1"],
      new_questions: ["How does Nia handle creative blocks?"]
    }
  }
})

// 3. Get context for continuation
story_manager({
  operation: "continue",
  story_id: "the_neural_canvas"
})
// Returns context with suggested directions

// 4. Write next segment based on context
story_manager({
  operation: "save_segment",
  story_id: "the_neural_canvas",
  segment: { ... }
})

// 5. Mark complete when done
story_manager({
  operation: "update_metadata",
  story_id: "the_neural_canvas",
  metadata: { status: "completed" }
})
```
