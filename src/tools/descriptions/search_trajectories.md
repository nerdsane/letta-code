Search past agent experiences to find relevant examples for the current task.

Use this tool to:
- Find successful approaches to similar tasks
- Learn from past failures (anti-patterns) to avoid mistakes
- Recall how specific tools were used before
- Get context on entity-specific operations (worlds, stories, rules)

The tool returns formatted examples with:
- Action taken and reasoning
- Context and result
- Success/failure indicators
- Lessons learned from failures

## When to Use

Call this tool when:
1. You're about to perform a complex operation and want to see similar past examples
2. You're unsure how to approach a task
3. You want to avoid past mistakes
4. You need guidance on using a specific tool

## Examples

Find successful approaches to creating world rules:
```json
{
  "query": "creating world rules with hard science constraints",
  "filters": { "domain": "dsf", "entity_type": "world" },
  "include_failures": true,
  "limit": 5
}
```

Learn from past story creation experiences:
```json
{
  "query": "writing story segments that test world rules",
  "filters": { "action_type": "story_manager" },
  "include_failures": false
}
```

## Response Format

The tool returns markdown-formatted context with:

**Relevant Past Decisions** - Successful examples with:
- Action, context, reasoning, result

**Anti-Patterns to Avoid** (if include_failures=true) - Failure examples with:
- Action, context, reasoning, result
- Error type and lessons learned
