/**
 * Deep Sci-Fi (DSF) World Management Types
 *
 * These types support evolving, richly detailed fictional worlds that grow
 * as stories are written. Based on how professional sci-fi writers approach
 * worldbuilding (the "iceberg model" - surface vs foundation).
 */

// ============================================================================
// Core World Structure
// ============================================================================

export interface World {
  development: DevelopmentMetadata;
  surface: Surface;
  foundation: Foundation;
  constraints: Constraint[];
  changelog?: ChangelogEntry[];
}

export interface DevelopmentMetadata {
  state: "sketch" | "draft" | "detailed";
  version: number;
  created: string;           // ISO timestamp
  last_modified: string;     // ISO timestamp
  revision_notes?: string[];
}

export interface Surface {
  opening_scene?: string;
  visible_elements: Element[];
  character_pov?: string;
  revealed_in_story: Record<string, RevealedInfo>;
}

export interface RevealedInfo {
  when: string;              // "chapter 1", "page 5", etc
  how: "shown" | "told" | "implied";
  context: string;
}

export interface Foundation {
  core_premise: string;
  deep_focus_areas: DeepFocusAreas;
  rules: Rule[];
  history?: History;
  geography?: Geography;
  culture?: Culture;
  technology?: Technology;
  working_notes?: WorkingNotes;
}

export interface DeepFocusAreas {
  primary: string[];         // 2-3 main areas to go deep on
  emerging?: string[];       // New areas being explored
  depth_level: Record<string, "surface" | "medium" | "deep">;
}

export interface WorkingNotes {
  tentative_ideas: string[];
  questions: string[];
  contradictions_to_resolve: string[];
}

// ============================================================================
// Elements, Rules, Constraints
// ============================================================================

export interface Element {
  id: string;
  type: string;              // "character", "location", "tech", etc
  name?: string;             // May use roles initially
  description: string;
  detail_level: "sketch" | "detailed";
  introduced_in_version: number;
  last_modified_version: number;
  relationships?: Relationship[];
  properties: Record<string, any>;
}

export interface Relationship {
  to: string;                // element_id
  type: string;              // "conflicts_with", "depends_on", etc
  strength: "weak" | "moderate" | "strong";
}

export interface Rule {
  id: string;
  statement: string;
  scope: "universal" | "local" | "conditional";
  certainty: "tentative" | "established" | "fundamental";
  introduced_in_version: number;
  revealed?: boolean;
  tested_in_story?: string[];
  implications?: string[];
  exceptions?: string[];
}

export interface Constraint {
  id: string;
  description: string;
  type: "physical" | "social" | "logical" | "narrative";
  strictness: "absolute" | "strong" | "weak";
}

// ============================================================================
// Optional Detailed Types
// ============================================================================

export interface History {
  timeline?: TimelineEvent[];
  eras?: string[];
  key_events?: string[];
}

export interface TimelineEvent {
  event: string;
  when: string;
  significance: string;
}

export interface Geography {
  locations?: Location[];
  spatial_relationships?: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  significance: string;
}

export interface Culture {
  values?: string[];
  taboos?: string[];
  practices?: string[];
  social_structure?: string;
}

export interface Technology {
  systems?: TechnologySystem[];
  tech_level?: string;
}

export interface TechnologySystem {
  id: string;
  name: string;
  how_it_works: string;
  limitations: string;
}

export interface ChangelogEntry {
  version: number;
  timestamp: string;
  changes: string[];
  reason: string;
}

// ============================================================================
// Tool Operation Types
// ============================================================================

export interface WorldDiff {
  version_diff: [number, number];
  timestamp_diff: [string, string];
  state_change?: ["sketch" | "draft" | "detailed", "sketch" | "draft" | "detailed"];
  elements_added: Element[];
  elements_removed: string[];  // IDs
  elements_modified: {
    id: string;
    changes: string[];
  }[];
  rules_added: Rule[];
  rules_removed: string[];     // IDs
  rules_modified: {
    id: string;
    changes: string[];
  }[];
  constraints_added: Constraint[];
  constraints_removed: string[]; // IDs
  depth_changes: Record<string, {
    from: "surface" | "medium" | "deep";
    to: "surface" | "medium" | "deep";
  }>;
  changelog_entries: ChangelogEntry[];
  summary: string;
}

export interface UpdateOperation {
  path: string;              // JSON path like "foundation.rules" or "surface.opening_scene"
  operation: "add" | "update" | "remove";
  value?: any;
  reason?: string;           // Why this change (goes into changelog)
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface ConsistencyReport {
  consistent: boolean;
  contradiction_count: number;
  contradictions: Contradiction[];
  edge_cases_checked: number;
  analysis_approach: string;
}

export interface Contradiction {
  elements: string[];        // IDs of conflicting elements
  description: string;
  severity: "minor" | "major";
  suggestion?: string;
}

export interface DepthAssessment {
  depth_score: number;       // 1-5
  depth_category: "surface" | "medium" | "deep";
  reasoning: string;
  strengths: string[];
  could_go_deeper: string[];
  comparison: string;        // "typical", "above average", "shallow"
}

export interface NoveltyReport {
  novelty_score: number;
  new_elements: {
    entities: string[];      // IDs
    rules: string[];
    relationships: string[];
  };
  surprisingness: number;
  insights: string[];
  significance: "minor iteration" | "moderate advance" | "major breakthrough";
}

export interface AbstractionReport {
  abstraction_score: number;
  concrete_names: {
    name: string;
    context: string;
    suggestion: string;
  }[];
  cultural_specifics: {
    element: string;
    context: string;
    suggestion: string;
  }[];
  unnecessary_details: string[];
  reasoning: string;
  examples_of_good_abstraction: string[];
}

export interface NarrativeEvaluation {
  structure: {
    has_conflict: boolean;
    has_stakes: boolean;
    character_agency: boolean;
    arc_complete: boolean;
  };
  grounding: {
    follows_world_rules: boolean;
    rules_used: string[];    // IDs
    violations: string[];
  };
  quality: {
    emotional_resonance: number;  // 1-5
    interestingness: number;      // 1-5
    originality: number;          // 1-5
  };
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export type EvaluationResult =
  | ConsistencyReport
  | DepthAssessment
  | NoveltyReport
  | AbstractionReport
  | NarrativeEvaluation;
