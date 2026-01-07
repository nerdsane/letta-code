/**
 * AgentSuggestions - Proactive suggestions from the agent
 *
 * Shows suggestions sent by the agent via send_suggestion tool.
 * Falls back to pattern-based suggestions if no agent suggestions exist.
 */
import React, { useState, useEffect } from 'react';
import type { World, Story, Rule, Element } from '../../../types/dsf';

export interface Suggestion {
  id: string;
  type?: 'rule' | 'branch' | 'character' | 'continuation' | 'world' | 'custom';
  title: string;
  description: string; // Full text, never truncated
  action: string;
  priority: 'high' | 'medium' | 'low';
  data?: any;
}

// Agent suggestion from Agent Bus
export interface AgentSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionId: string;
  actionLabel?: string;
  actionData?: any;
}

export interface AgentSuggestionsProps {
  world?: World | null;
  story?: Story | null;
  stories?: Story[];
  /** Suggestions from agent (via Agent Bus) - these take priority */
  agentSuggestions?: AgentSuggestion[];
  onAccept: (suggestion: Suggestion) => void;
  onDismiss: (suggestionId: string) => void;
  maxSuggestions?: number;
  position?: 'sidebar' | 'floating' | 'inline';
}

export function AgentSuggestions({
  world,
  story,
  stories = [],
  agentSuggestions = [],
  onAccept,
  onDismiss,
  maxSuggestions = 5,
  position = 'floating',
}: AgentSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Generate suggestions: prefer agent suggestions, fall back to patterns
  useEffect(() => {
    // Convert agent suggestions to Suggestion format
    const fromAgent: Suggestion[] = agentSuggestions.map((s) => ({
      id: s.id,
      type: 'custom' as const,
      title: s.title,
      description: s.description, // Full text, never truncated
      action: s.actionLabel || 'Accept',
      priority: s.priority,
      data: { actionId: s.actionId, ...s.actionData },
    }));

    // If we have agent suggestions, use those primarily
    if (fromAgent.length > 0) {
      const filtered = fromAgent
        .filter((s) => !dismissedIds.has(s.id))
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, maxSuggestions);
      setSuggestions(filtered);
      return;
    }

    // Fall back to pattern-based suggestions
    const newSuggestions: Suggestion[] = [];

    // Analyze world rules for unused ones
    if (world?.foundation?.rules) {
      const untestedRules = world.foundation.rules.filter(
        (rule) => !rule.tested_in_story || rule.tested_in_story.length === 0
      );
      if (untestedRules.length > 0) {
        const rule = untestedRules[0];
        newSuggestions.push({
          id: `rule-${rule.id}`,
          type: 'rule',
          title: 'Unexplored Rule',
          description: rule.statement, // Full text, no truncation
          action: 'Test in story',
          priority: rule.certainty === 'tentative' ? 'high' : 'medium',
          data: rule,
        });
      }
    }

    // Check for pending branches in current story
    if (story?.segments) {
      for (const segment of story.segments) {
        if (segment.branches) {
          const pendingBranches = segment.branches.filter((b) => b.status === 'pending');
          for (const branch of pendingBranches.slice(0, 1)) {
            newSuggestions.push({
              id: `branch-${branch.id}`,
              type: 'branch',
              title: 'Unexplored Branch',
              description: branch.prompt,
              action: 'Explore this path',
              priority: 'high',
              data: { segment, branch },
            });
          }
        }
      }
    }

    // Find characters that haven't appeared recently
    if (world?.surface?.visible_elements && story?.segments) {
      const characters = world.surface.visible_elements.filter((e) => e.type === 'character');
      const recentSegments = story.segments.slice(-3);
      const recentContent = recentSegments.map((s) => s.content).join(' ');

      for (const char of characters.slice(0, 2)) {
        if (char.name && !recentContent.includes(char.name)) {
          newSuggestions.push({
            id: `char-${char.id}`,
            type: 'character',
            title: 'Character Opportunity',
            description: `${char.name} hasn't appeared recently`,
            action: 'Bring into story',
            priority: 'low',
            data: char,
          });
        }
      }
    }

    // Suggest story continuation if story is active
    if (story?.metadata?.status === 'active' && story.segments.length > 0) {
      const lastSegment = story.segments[story.segments.length - 1];
      if (lastSegment.world_evolution?.new_questions?.length) {
        newSuggestions.push({
          id: `continue-${story.id}`,
          type: 'continuation',
          title: 'Continue Story',
          description: lastSegment.world_evolution.new_questions[0],
          action: 'Write next segment',
          priority: 'medium',
          data: { story, question: lastSegment.world_evolution.new_questions[0] },
        });
      }
    }

    // Suggest world development if world is in sketch/draft state
    if (world?.development?.state === 'sketch') {
      newSuggestions.push({
        id: `develop-world`,
        type: 'world',
        title: 'Develop World',
        description: 'World is still in sketch state',
        action: 'Add more depth',
        priority: 'medium',
        data: world,
      });
    }

    // Filter out dismissed suggestions and limit
    const filtered = newSuggestions
      .filter((s) => !dismissedIds.has(s.id))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, maxSuggestions);

    setSuggestions(filtered);
  }, [world, story, stories, agentSuggestions, dismissedIds, maxSuggestions]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    onDismiss(id);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className={`dsf-agent-suggestions dsf-agent-suggestions--${position} ${isCollapsed ? 'dsf-agent-suggestions--collapsed' : ''}`}>
      <button
        className="dsf-agent-suggestions__header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="dsf-agent-suggestions__icon">◇</span>
        <span className="dsf-agent-suggestions__title">
          Agent Suggests ({suggestions.length})
        </span>
        <span className="dsf-agent-suggestions__toggle">
          {isCollapsed ? '▼' : '▲'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="dsf-agent-suggestions__list">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`dsf-agent-suggestions__item dsf-agent-suggestions__item--${suggestion.priority}`}
            >
              <div className="dsf-agent-suggestions__item-header">
                <span className="dsf-agent-suggestions__item-type">
                  {suggestion.type === 'rule' && '◈'}
                  {suggestion.type === 'branch' && '◇'}
                  {suggestion.type === 'character' && '○'}
                  {suggestion.type === 'continuation' && '→'}
                  {suggestion.type === 'world' && '✦'}
                  {suggestion.type === 'custom' && '◆'}
                </span>
                <span className="dsf-agent-suggestions__item-title">
                  {suggestion.title}
                </span>
                <button
                  className="dsf-agent-suggestions__dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(suggestion.id);
                  }}
                >
                  ×
                </button>
              </div>
              <p className="dsf-agent-suggestions__item-desc">{suggestion.description}</p>
              <button
                className="dsf-agent-suggestions__action"
                onClick={() => onAccept(suggestion)}
              >
                {suggestion.action} →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
