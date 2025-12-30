Manages DSF (Deep Sci-Fi) worlds: save, load, compare, and evolve fictional worlds.

## Operations

### save
Persist a world to filesystem with auto-incrementing version.

```typescript
world_manager({
  operation: "save",
  checkpoint_name: "my_world",
  world: worldObject  // See "World Structure" section below for complete example
})
```

- Auto-increments version number
- Updates last_modified timestamp
- Adds revision_notes to changelog if present
- Saves to `.dsf/worlds/{checkpoint_name}.json`
- **See "World Structure" section below for complete World object format**

### load
Restore a world from a checkpoint.

```typescript
world_manager({
  operation: "load",
  checkpoint_name: "my_world"
})
```

Returns the world object with all its data.

### diff
Compare two world versions to see what changed.

```typescript
world_manager({
  operation: "diff",
  checkpoint_name: "my_world",    // earlier version
  checkpoint_name_2: "my_world"   // later version (can be same name if versions differ)
})
```

Returns detailed diff showing:
- Version and timestamp changes
- Elements added/removed/modified
- Rules added/removed/modified
- Depth changes in focus areas
- Changelog entries

### update
Evolve a world by applying incremental updates.

```typescript
world_manager({
  operation: "update",
  current_checkpoint: "my_world",
  updates: [
    {
      path: "foundation.rules",
      operation: "add",
      value: {
        id: "rule_3",
        statement: "FTL travel requires quantum entanglement",
        scope: "universal",
        certainty: "tentative",
        introduced_in_version: 2
      },
      reason: "Added FTL constraint for story conflict"
    },
    {
      path: "surface.opening_scene",
      operation: "update",
      value: "The station hung in the void...",
      reason: "Revised opening for better hook"
    }
  ]
})
```

- Loads current world
- Applies all updates in sequence
- Adds reasons to changelog
- Auto-increments version
- Saves updated world

Update operations:
- `add`: Append to array or set new value
- `update`: Replace existing value
- `remove`: Delete from array (by id) or remove property

## Usage Notes

- Worlds evolve through versions - each save increments the version
- Use `revision_notes` in world.development to document changes
- Checkpoint names can be reused - the version number tracks evolution
- The `update` operation is the primary way to evolve worlds incrementally
- Always provide `reason` in updates to maintain clear changelog

## World Structure

Worlds follow the "iceberg model":
- **Surface**: What appears in the story (opening scene, visible elements, character POV)
- **Foundation**: Hidden worldbuilding (premise, rules, history, culture, technology)
- **Constraints**: Physical, social, logical, or narrative limitations

Worlds support progressive elaboration - start with a sketch and add detail as the story develops.

### Complete World Example

```typescript
{
  development: {
    state: "sketch",                    // or "draft", "detailed"
    version: 1,
    created: "2025-01-15T10:30:00Z",   // ISO timestamp
    last_modified: "2025-01-15T10:30:00Z",
    revision_notes: []                  // Array of strings
  },

  surface: {
    opening_scene: "The station hung in the void...",
    visible_elements: [
      {
        id: "elem_1",
        type: "character",
        name: "The Navigator",           // Use roles, not concrete names
        description: "Station commander with neural interface",
        detail_level: "detailed",
        introduced_in_version: 1,
        last_modified_version: 1,
        properties: { role: "protagonist", age_range: "30s" }
      }
    ],
    character_pov: "The Navigator",
    revealed_in_story: {}                // Track what reader knows
  },

  foundation: {
    core_premise: "Neural interfaces read emotional states, enabling AI to understand human intent",

    deep_focus_areas: {
      primary: ["neural_interfaces", "ai_world_models"],
      depth_level: {
        "neural_interfaces": "medium",
        "ai_world_models": "deep"
      }
    },

    rules: [
      {
        id: "rule_1",
        statement: "Neural interfaces can read emotional/intentional states but not thoughts",
        scope: "universal",
        certainty: "established",
        introduced_in_version: 1
      }
    ],

    // Optional sections - add as needed
    history: {
      timeline: [
        {
          event: "Neural interface breakthrough",
          when: "2028",
          significance: "Enabled emotional state reading"
        }
      ]
    },

    geography: {
      locations: [
        {
          id: "loc_1",
          name: "The Station",
          description: "Orbital research facility",
          significance: "Where the story takes place"
        }
      ]
    },

    culture: {
      values: ["emotional authenticity", "creative expression"],
      practices: ["neural art sessions"]
    },

    technology: {
      systems: [
        {
          id: "tech_1",
          name: "Affective Interface",
          how_it_works: "Reads emotional states via EEG patterns",
          limitations: "Cannot read thoughts or images"
        }
      ]
    },

    working_notes: {
      tentative_ideas: ["Maybe consciousness is quantum?"],
      questions: ["How do they handle interface failures?"],
      contradictions_to_resolve: []
    }
  },

  constraints: [
    {
      id: "const_1",
      description: "Neural interfaces cannot read thoughts or mental images",
      type: "physical",
      strictness: "absolute"
    }
  ],

  changelog: []                          // Auto-populated on saves
}
```

### Minimal World (for quick starts)

```typescript
{
  development: {
    state: "sketch",
    version: 1,
    created: "2025-01-15T10:30:00Z",
    last_modified: "2025-01-15T10:30:00Z",
    revision_notes: []
  },
  surface: {
    visible_elements: [],
    revealed_in_story: {}
  },
  foundation: {
    core_premise: "Your premise here",
    deep_focus_areas: {
      primary: ["area1", "area2"],
      depth_level: {}
    },
    rules: []
  },
  constraints: []
}
```
