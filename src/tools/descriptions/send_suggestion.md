Send a proactive suggestion to the canvas UI. Use this to offer contextual suggestions to the user.

## When to Use

Send suggestions when you notice opportunities:
- After generating content: suggest related follow-up actions
- When detecting unused elements: suggest incorporating them
- Based on current context: suggest next steps
- When you have ideas that might help the user

## Examples

### Suggest exploring an unused world rule
```json
{
  "title": "Unexplored Rule",
  "description": "The rule 'Quantum mechanics allows consciousness transfer between bodies' hasn't been tested in any story yet. This could create interesting dramatic tension - what happens when someone's consciousness is transferred against their will?",
  "priority": "medium",
  "action_id": "test_rule_in_story",
  "action_label": "Test in story",
  "action_data": { "rule_id": "qm-consciousness-001" }
}
```

### Suggest continuing a story
```json
{
  "title": "Story Continuation",
  "description": "The last segment ended with Maya discovering the hidden laboratory. Several story threads are open: the mysterious signal, Dr. Chen's warning, and the locked door. Continuing now would maintain narrative momentum.",
  "priority": "high",
  "action_id": "continue_story",
  "action_label": "Continue writing",
  "action_data": { "story_id": "story-123", "segment_id": "seg-456" }
}
```

### Suggest developing a character
```json
{
  "title": "Character Development",
  "description": "Dr. Elara Chen has appeared in 3 segments but her motivations remain unclear. Developing her backstory could add depth - why did she leave the corporation? What does she know about the signal?",
  "priority": "low",
  "action_id": "develop_character",
  "action_label": "Develop character",
  "action_data": { "character_id": "char-elara" }
}
```

## Guidelines

1. **Be specific**: Include enough context for the user to understand the value
2. **Don't spam**: Send 1-3 suggestions at a time, not a flood
3. **Be actionable**: Each suggestion should lead to a clear next step
4. **Priority matters**: Use high sparingly (only for time-sensitive or critical suggestions)
5. **Full descriptions**: Never truncate - users need full context to decide
