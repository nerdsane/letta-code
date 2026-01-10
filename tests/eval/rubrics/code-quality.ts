/**
 * Code Quality Evaluation Rubric
 *
 * Used with Letta's assess_output_quality tool to evaluate
 * generated code against quality criteria.
 */

export const CODE_QUALITY_RUBRIC = `
Evaluate this code against these criteria:

1. CORRECTNESS (0.3 weight)
   - Does it do what it claims to do?
   - Are edge cases handled?
   - No obvious bugs?

2. READABILITY (0.2 weight)
   - Clear naming?
   - Appropriate comments (not too many, not too few)?
   - Logical structure?

3. TYPE SAFETY (0.2 weight)
   - No 'any' types without justification?
   - Proper interfaces/types defined?
   - Null/undefined handled?

4. ERROR HANDLING (0.2 weight)
   - Errors caught and handled appropriately?
   - No silent failures?
   - User-facing errors are helpful?

5. PERFORMANCE (0.1 weight)
   - No obvious N+1 or O(n²) issues?
   - Appropriate data structures?
   - No unnecessary work?

Score 0.0-1.0 with reasoning for each criterion.
Return JSON with: { score: number, criteria: { name: string, score: number, reasoning: string }[], recommendations: string[] }
`;

export const CODE_QUALITY_THRESHOLD = 0.7;

/**
 * Simplified rubric for quick checks
 */
export const CODE_QUALITY_QUICK_RUBRIC = `
Quick code quality check:
1. Does it work? (no obvious bugs)
2. Is it readable? (clear naming, logical structure)
3. Is it safe? (error handling, no silent failures)

Score 0.0-1.0 with brief reasoning.
`;

/**
 * Rubric for TypeScript-specific quality
 */
export const TYPESCRIPT_QUALITY_RUBRIC = `
TypeScript-specific quality evaluation:

1. TYPE DEFINITIONS (0.3 weight)
   - Are types properly defined vs inferred?
   - No unnecessary 'any' or 'unknown'?
   - Generic types used appropriately?

2. NULLABILITY (0.2 weight)
   - Optional chaining used correctly?
   - Null checks where needed?
   - Non-null assertions justified?

3. IMPORTS/EXPORTS (0.2 weight)
   - Named exports preferred over default?
   - No circular dependencies?
   - Tree-shakeable structure?

4. ASYNC PATTERNS (0.2 weight)
   - Proper async/await usage?
   - Error handling in promises?
   - No unhandled rejections?

5. CONSISTENCY (0.1 weight)
   - Follows project conventions?
   - Consistent style?
   - No conflicting patterns?

Score 0.0-1.0 with reasoning.
`;

/**
 * No-cap verification rubric (for /no-cap skill)
 */
export const NO_CAP_RUBRIC = `
Post-implementation verification check:

CRITICAL ISSUES (any found = fail):
- TODO/FIXME/HACK comments that indicate unfinished work
- Placeholder implementations (stub functions, mock data in production)
- Silent failures (catch blocks that swallow errors)
- console.log statements (except in tests/debugging tools)
- Commented-out code blocks
- 'any' types without justification comment

WARNINGS (note but don't fail):
- Intentional TODOs for future enhancements (must be documented)
- Feature flags for upcoming features
- Deprecation notices

Return JSON:
{
  pass: boolean,
  critical_issues: { type: string, file: string, line: number, description: string }[],
  warnings: { type: string, file: string, line: number, description: string }[],
  summary: string
}
`;
