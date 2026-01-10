/**
 * Story Quality Evaluation Rubric
 *
 * Used with Letta's assess_output_quality tool to evaluate
 * generated stories against narrative and scientific grounding criteria.
 */

export const STORY_QUALITY_RUBRIC = `
Evaluate this story against these criteria:

1. NARRATIVE COHERENCE (0.25 weight)
   - Events follow logically
   - No plot holes or contradictions
   - Cause and effect are clear
   - Pacing is appropriate

2. WORLD CONSISTENCY (0.25 weight)
   - Follows established world rules
   - Technology works as documented
   - No "magic" solutions that violate physics
   - Consistent with world's history/culture

3. CHARACTER DEPTH (0.2 weight)
   - Characters have clear motivations
   - Actions align with established traits
   - Growth or change is believable
   - Distinct voices and personalities

4. ENGAGEMENT (0.2 weight)
   - Creates tension/interest
   - Reader wants to continue
   - Emotional resonance
   - Appropriate stakes

5. PROSE QUALITY (0.1 weight)
   - Clear, evocative writing
   - Show don't tell
   - Appropriate tone for genre
   - No purple prose or clichés

Score 0.0-1.0 with reasoning for each criterion.
Return JSON with: { score: number, criteria: { name: string, score: number, reasoning: string }[], strengths: string[], improvements: string[] }
`;

export const STORY_QUALITY_THRESHOLD = 0.7;

/**
 * Rubric for world consistency specifically
 */
export const WORLD_CONSISTENCY_RUBRIC = `
Check if this story content is consistent with the provided world rules:

WORLD RULES:
{rules}

STORY CONTENT:
{content}

For each rule, verify:
1. Is the rule followed in the story?
2. Are there any violations or contradictions?
3. Is the rule's spirit maintained (not just letter)?

Return JSON:
{
  consistent: boolean,
  rule_checks: {
    rule: string,
    followed: boolean,
    evidence: string,
    violation_severity: "none" | "minor" | "major" | "critical"
  }[],
  overall_assessment: string
}
`;

/**
 * Rubric for scientific grounding in stories
 */
export const SCIENTIFIC_GROUNDING_RUBRIC = `
Evaluate the scientific plausibility of this story content:

1. TECHNOLOGY CONSISTENCY
   - Does technology work consistently?
   - Are limitations respected?
   - No unexplained capabilities?

2. PHYSICS ADHERENCE
   - Does the story respect its physics rules?
   - Are speculative elements acknowledged?
   - No hand-waving for plot convenience?

3. CONSEQUENCE FOLLOWING
   - Do actions have appropriate consequences?
   - Are second-order effects considered?
   - Does cause precede effect?

4. SPECULATION HONESTY
   - Is hard science distinguished from speculation?
   - Are fantastical elements acknowledged?
   - Is the science level consistent?

Return JSON:
{
  plausibility_score: number (0.0-1.0),
  issues: {
    type: "inconsistency" | "violation" | "handwave" | "unexplained",
    description: string,
    severity: "minor" | "major" | "breaking"
  }[],
  classification: "hard_science" | "plausible_extrapolation" | "soft_scifi" | "fantasy",
  assessment: string
}
`;

/**
 * Rubric for multi-perspective coherence
 */
export const PERSPECTIVE_COHERENCE_RUBRIC = `
Check if this narrative from a specific character's perspective is consistent with the canonical events:

CANONICAL EVENTS:
{events}

CHARACTER'S PERSPECTIVE:
{character}

NARRATIVE:
{narrative}

Verify:
1. CHARACTER KNOWLEDGE: Does the character only know what they've learned?
2. PHYSICAL FACTS: Are described events consistent with what happened?
3. TEMPORAL ORDER: Is the sequence correct from this character's POV?
4. SENSORY LIMITS: Can the character observe what they describe?

Return JSON:
{
  consistent: boolean,
  violations: {
    type: "impossible_knowledge" | "factual_error" | "temporal_error" | "sensory_impossibility",
    description: string,
    narrative_excerpt: string,
    canonical_fact: string
  }[],
  assessment: string
}
`;

/**
 * Quick story quality check
 */
export const STORY_QUICK_RUBRIC = `
Quick story quality check:
1. Is it coherent? (events make sense, no plot holes)
2. Is it engaging? (creates interest, appropriate tension)
3. Is it consistent? (follows world rules, characters stay in character)

Score 0.0-1.0 with brief reasoning.
`;
