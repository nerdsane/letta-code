/**
 * World Consistency Evaluation Rubric
 *
 * Used with Letta's check_logical_consistency tool to verify
 * world building maintains internal consistency.
 */

export const WORLD_CONSISTENCY_RUBRIC = `
Check this world for internal logical consistency:

1. RULE COHERENCE
   - Do rules contradict each other?
   - Are scope boundaries clear (universal vs local)?
   - Are exceptions properly defined?

2. TECHNOLOGY CONSISTENCY
   - Do technologies respect the rules?
   - Are capabilities and limitations balanced?
   - Is the tech level consistent across the world?

3. HISTORY PLAUSIBILITY
   - Does the timeline make sense?
   - Do events have appropriate causes?
   - Are cultural developments explained?

4. CROSS-DOMAIN ALIGNMENT
   - Does physics → technology → economics → social chain hold?
   - Are implications cascaded correctly?
   - No isolated elements that ignore context?

Return JSON:
{
  consistent: boolean,
  contradictions: {
    element1: string,
    element2: string,
    description: string,
    severity: "minor" | "major" | "critical"
  }[],
  missing_implications: string[],
  recommendations: string[]
}
`;

/**
 * Rules for common world-building consistency checks
 */
export const COMMON_WORLD_RULES = [
  // Physics
  "Energy is conserved (no perpetual motion, no free energy)",
  "Information cannot travel faster than the fastest transport",
  "Technology requires resources and infrastructure to build and maintain",

  // Economics
  "Scarcity drives economics; abundance changes everything",
  "Trade requires something both parties want",
  "Infrastructure scales with population and technology",

  // Social
  "Cultures adapt to their environment and technology",
  "Power structures emerge from control of scarce resources",
  "Communication speed affects political organization scale",
];

/**
 * Rubric for checking if a new element is consistent with existing world
 */
export const NEW_ELEMENT_CONSISTENCY_RUBRIC = `
Check if this new element is consistent with the existing world:

EXISTING WORLD:
{world}

NEW ELEMENT:
{element}

Verify:
1. Does it contradict existing rules?
2. Does it require changes to other elements?
3. What implications does it create?
4. Does it fit the world's tech/social level?

Return JSON:
{
  consistent: boolean,
  conflicts: {
    existing_element: string,
    conflict_type: "contradiction" | "implication_missing" | "level_mismatch",
    description: string
  }[],
  required_updates: string[],
  new_implications: string[]
}
`;

/**
 * Rubric for cross-domain consistency
 */
export const CROSS_DOMAIN_RUBRIC = `
Validate that implications cascade correctly across domains:

DOMAIN CHAIN: Physics → Technology → Economics → Social → Political

For each domain transition, verify:
1. Upstream changes reflect in downstream domains
2. No downstream elements contradict upstream rules
3. Implications are not artificially limited

Return JSON:
{
  consistent: boolean,
  domain_checks: {
    from_domain: string,
    to_domain: string,
    upstream_element: string,
    expected_downstream: string,
    actual_downstream: string | null,
    gap_type: "missing" | "contradictory" | "incomplete" | "ok"
  }[],
  recommendations: string[]
}
`;

/**
 * Rubric for checking causal chain completeness
 */
export const CAUSAL_CHAIN_RUBRIC = `
Verify that the causal chain from present to future is complete:

TARGET ELEMENT: {element}
TARGET YEAR: {year}
CAUSAL CHAIN: {chain}

For each step in the chain:
1. Is the prerequisite actually required?
2. Is the timeline plausible?
3. Are there missing intermediate steps?
4. Is the scientific basis sound?

Return JSON:
{
  complete: boolean,
  chain_quality: number (0.0-1.0),
  gaps: {
    after_step: string,
    missing_prerequisite: string,
    importance: "critical" | "significant" | "minor"
  }[],
  timeline_issues: {
    step: string,
    issue: "too_fast" | "too_slow" | "implausible",
    explanation: string
  }[],
  speculative_leaps: string[]
}
`;

/**
 * Information gain rubric for world iterations
 */
export const INFORMATION_GAIN_RUBRIC = `
Analyze whether this world iteration adds genuine depth:

PREVIOUS VERSION:
{before}

CURRENT VERSION:
{after}

Evaluate:
1. NEW FACTS: What concrete information was added?
2. DEPTH: Does it explain "why" not just "what"?
3. CONNECTIONS: Does it link to existing elements?
4. NOVELTY: Is it non-obvious, not just elaboration?
5. UTILITY: Does it enable new story possibilities?

Return JSON:
{
  information_gain: number (0.0-1.0),
  new_facts: string[],
  depth_additions: string[],
  connections_made: string[],
  significance: "trivial" | "minor" | "moderate" | "major" | "breakthrough",
  redundant_content: string[],
  assessment: string
}
`;
