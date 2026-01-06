import React from 'react';
import type { World, Story } from '../../../types/dsf';
import { Hero, ScrollSection, ActionBar } from '../experience';
import './welcome-space.css';

export interface WelcomeSpaceProps {
  worlds: World[];
  stories: Story[];
  onSelectWorld: (world: World) => void;
  onSelectStory: (story: Story) => void;
  onStartNewWorld?: () => void;
}

export function WelcomeSpace({
  worlds,
  stories,
  onSelectWorld,
  onSelectStory,
  onStartNewWorld,
}: WelcomeSpaceProps) {
  // Get active stories for "Continue" section
  const activeStories = stories.filter(s => s.metadata.status === 'active');
  const recentStories = activeStories.slice(0, 3);

  // Get time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Build welcome message
  const hasActiveStories = activeStories.length > 0;
  const subtitle = hasActiveStories
    ? `You have ${activeStories.length} stor${activeStories.length === 1 ? 'y' : 'ies'} in progress`
    : 'Ready to explore new worlds?';

  // Build actions
  const actions = [
    ...(recentStories.length > 0 ? [{
      id: 'continue-recent',
      label: `Continue "${recentStories[0].metadata.title}"`,
      variant: 'primary' as const,
    }] : []),
    ...(worlds.length > 0 ? [{
      id: 'explore-worlds',
      label: 'Explore worlds',
      description: `${worlds.length} world${worlds.length === 1 ? '' : 's'} available`,
      variant: 'branch' as const,
    }] : []),
    ...(onStartNewWorld ? [{
      id: 'new-world',
      label: 'Create new world',
      variant: 'branch' as const,
    }] : []),
  ];

  return (
    <div className="welcome-space">
      {/* Hero Section */}
      <Hero
        title={greeting}
        subtitle={subtitle}
        badge="Deep Sci-Fi"
        meta={[
          `${worlds.length} worlds`,
          `${stories.length} stories`,
        ]}
        height="large"
        overlay="gradient"
        showScrollIndicator={recentStories.length > 0 || worlds.length > 0}
      />

      {/* Continue Reading Section */}
      {recentStories.length > 0 && (
        <section className="welcome-space__section">
          <ScrollSection animation="fade-up">
            <h2 className="welcome-space__section-title">
              <span className="welcome-space__section-icon">→</span>
              Continue Reading
            </h2>
            <div className="welcome-space__stories">
              {recentStories.map((story, i) => (
                <ScrollSection key={story.id} animation="slide-left" delay={i * 100}>
                  <button
                    className="welcome-space__story-card"
                    onClick={() => onSelectStory(story)}
                  >
                    <div className="welcome-space__story-info">
                      <h3 className="welcome-space__story-title">{story.metadata.title}</h3>
                      <p className="welcome-space__story-meta">
                        {story.segments.length} segments · Last updated recently
                      </p>
                    </div>
                    <span className="welcome-space__story-arrow">→</span>
                  </button>
                </ScrollSection>
              ))}
            </div>
          </ScrollSection>
        </section>
      )}

      {/* Worlds Section */}
      {worlds.length > 0 && (
        <section className="welcome-space__section">
          <ScrollSection animation="fade-up">
            <h2 className="welcome-space__section-title">
              <span className="welcome-space__section-icon">◈</span>
              Your Worlds
            </h2>
            <div className="welcome-space__worlds-grid">
              {worlds.map((world, i) => (
                <ScrollSection key={world.foundation.name} animation="scale" delay={i * 100}>
                  <button
                    className="welcome-space__world-card"
                    onClick={() => onSelectWorld(world)}
                  >
                    <div className="welcome-space__world-header">
                      <span className="welcome-space__world-badge">
                        {world.foundation.time_period || 'Unknown Era'}
                      </span>
                    </div>
                    <h3 className="welcome-space__world-name">{world.foundation.name}</h3>
                    <p className="welcome-space__world-premise">{world.foundation.premise}</p>
                    <div className="welcome-space__world-stats">
                      <span>{world.surface.visible_elements.length} elements</span>
                      <span>v{world.development.version}</span>
                    </div>
                  </button>
                </ScrollSection>
              ))}
            </div>
          </ScrollSection>
        </section>
      )}

      {/* Empty State */}
      {worlds.length === 0 && stories.length === 0 && (
        <section className="welcome-space__section welcome-space__section--empty">
          <ScrollSection animation="fade-up">
            <div className="welcome-space__empty">
              <span className="welcome-space__empty-icon">◇</span>
              <h3 className="welcome-space__empty-title">Begin Your Journey</h3>
              <p className="welcome-space__empty-text">
                Create your first world to start crafting stories in the Deep Sci-Fi universe.
              </p>
            </div>
          </ScrollSection>
        </section>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <ActionBar
          title="What would you like to do?"
          actions={actions}
          onAction={(actionId) => {
            if (actionId === 'continue-recent' && recentStories[0]) {
              onSelectStory(recentStories[0]);
            } else if (actionId === 'explore-worlds' && worlds[0]) {
              onSelectWorld(worlds[0]);
            } else if (actionId === 'new-world') {
              onStartNewWorld?.();
            }
          }}
        />
      )}
    </div>
  );
}
