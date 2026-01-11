import { useCallback, useState } from "react";
import type { Story, World } from "../../../types/dsf";
import { ActionBar, Hero, ScrollSection } from "../experience";
import { type ElementType, InteractiveElement } from "../interaction";
import "./welcome-space.css";

export interface WelcomeSpaceProps {
  worlds: World[];
  stories: Story[];
  onSelectWorld: (world: World) => void;
  onSelectStory: (story: Story) => void;
  onStartNewWorld?: () => void;
  onElementAction?: (
    actionId: string,
    elementId: string,
    elementType: ElementType,
    elementData?: any,
  ) => void;
  // World card UX tracking
  newWorldIds?: Set<string>;
  pendingImageWorldIds?: Set<string>;
  recentImageWorldIds?: Set<string>;
}

// Helper to derive world title
function getWorldTitle(world: World): string {
  if (world.surface?.visible_elements?.[0]?.name) {
    return world.surface.visible_elements[0].name;
  }
  const premise = world.foundation?.core_premise || "Untitled World";
  const words = premise.split(" ").slice(0, 5);
  return (
    words.join(" ") + (words.length < premise.split(" ").length ? "..." : "")
  );
}

// Helper to derive world era
function getWorldEra(world: World): string {
  return (
    world.foundation?.history?.eras?.[0] || world.development?.state || "Active"
  );
}

// Helper to get world ID - must match getWorldCheckpointName in app.tsx
function getWorldId(world: World): string {
  // Use server-provided checkpoint name if available
  if ((world as any).checkpoint_name) {
    return (world as any).checkpoint_name;
  }

  // Fallback: derive checkpoint name from world data
  const premise = world.foundation?.core_premise || "";
  return (
    premise
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 30) || "unnamed_world"
  );
}

// World card with image loading state
function WorldCard({
  world,
  worldId,
  isNew,
  hasPendingImage,
  hasRecentImage,
  onClick,
}: {
  world: World;
  worldId: string;
  isNew: boolean;
  hasPendingImage: boolean;
  hasRecentImage: boolean;
  onClick: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Build class names
  const classNames = ["welcome-space__world-card"];
  if (isNew) classNames.push("welcome-space__world-card--new");
  if (hasPendingImage)
    classNames.push("welcome-space__world-card--pending-image");
  if (hasRecentImage)
    classNames.push("welcome-space__world-card--image-loaded");

  const hasImage = world.asset?.path && !imageError;

  return (
    <button type="button" className={classNames.join(" ")} onClick={onClick}>
      {/* Image container - always show if world has asset path */}
      {world.asset?.path && (
        <div className="welcome-space__world-image-container">
          {/* Placeholder diamond while loading or on error */}
          {(!imageLoaded || imageError) && (
            <div className="welcome-space__world-image-placeholder">◇</div>
          )}
          {/* Loading spinner overlay when pending */}
          {hasPendingImage && !imageLoaded && !imageError && (
            <div className="welcome-space__world-image-loading">
              <div className="welcome-space__world-image-spinner" />
            </div>
          )}
          {/* Actual image */}
          {!imageError && (
            <img
              src={`/api/assets/${world.asset.path}`}
              alt={world.asset.description || "World cover"}
              className={`welcome-space__world-image ${imageLoaded ? "welcome-space__world-image--loaded" : ""}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>
      )}
      <div className="welcome-space__world-header">
        <span className="welcome-space__world-badge">{getWorldEra(world)}</span>
      </div>
      <h3 className="welcome-space__world-name">{getWorldTitle(world)}</h3>
      <p className="welcome-space__world-premise">
        {world.foundation?.core_premise || ""}
      </p>
      <div className="welcome-space__world-stats">
        <span>{world.surface?.visible_elements?.length || 0} elements</span>
        <span>v{world.development?.version || 0}</span>
      </div>
    </button>
  );
}

export function WelcomeSpace({
  worlds,
  stories,
  onSelectWorld,
  onSelectStory,
  onStartNewWorld,
  onElementAction,
  newWorldIds = new Set(),
  pendingImageWorldIds = new Set(),
  recentImageWorldIds = new Set(),
}: WelcomeSpaceProps) {
  // Default action handler
  const handleAction = (
    actionId: string,
    elementId: string,
    elementType: ElementType,
    elementData?: any,
  ) => {
    if (onElementAction) {
      onElementAction(actionId, elementId, elementType, elementData);
    } else if (actionId === "enter" && elementType === "world_card") {
      onSelectWorld(elementData);
    } else if (actionId === "read" && elementType === "story_card") {
      onSelectStory(elementData);
    }
  };
  // Get active stories for "Continue" section
  const activeStories = stories.filter((s) => s.metadata.status === "active");
  const recentStories = activeStories.slice(0, 3);

  // Get time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Build welcome message
  const hasActiveStories = activeStories.length > 0;
  const subtitle = hasActiveStories
    ? `You have ${activeStories.length} stor${activeStories.length === 1 ? "y" : "ies"} in progress`
    : "Ready to explore new worlds?";

  return (
    <div className="welcome-space">
      {/* Hero Section - Compact for content-first design */}
      <Hero
        title={greeting}
        subtitle={subtitle}
        meta={[`${worlds.length} worlds`, `${stories.length} stories`]}
        height="compact"
        overlay="gradient"
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
                <ScrollSection
                  key={story.id}
                  animation="slide-left"
                  delay={i * 100}
                >
                  <InteractiveElement
                    elementType="story_card"
                    elementId={story.id}
                    elementData={story}
                    onAction={handleAction}
                  >
                    <button
                      type="button"
                      className="welcome-space__story-card"
                      onClick={() => onSelectStory(story)}
                    >
                      <div className="welcome-space__story-info">
                        <h3 className="welcome-space__story-title">
                          {story.metadata.title}
                        </h3>
                        <p className="welcome-space__story-meta">
                          {story.segments.length} segments · Last updated
                          recently
                        </p>
                      </div>
                      <span className="welcome-space__story-arrow">→</span>
                    </button>
                  </InteractiveElement>
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
              {worlds.map((world, i) => {
                const worldId = getWorldId(world);
                const isNew = newWorldIds.has(worldId);
                const hasPendingImage = pendingImageWorldIds.has(worldId);
                const hasRecentImage = recentImageWorldIds.has(worldId);

                return (
                  <ScrollSection
                    key={worldId + i}
                    animation="scale"
                    delay={i * 100}
                  >
                    <InteractiveElement
                      elementType="world_card"
                      elementId={worldId}
                      elementData={world}
                      onAction={handleAction}
                    >
                      <WorldCard
                        world={world}
                        worldId={worldId}
                        isNew={isNew}
                        hasPendingImage={hasPendingImage}
                        hasRecentImage={hasRecentImage}
                        onClick={() => onSelectWorld(world)}
                      />
                    </InteractiveElement>
                  </ScrollSection>
                );
              })}
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
                Create your first world to start crafting stories.
              </p>
            </div>
          </ScrollSection>
          {onStartNewWorld && (
            <ActionBar
              title="Get started"
              actions={[
                {
                  id: "new-world",
                  label: "Create new world",
                  variant: "primary",
                },
              ]}
              onAction={() => onStartNewWorld()}
            />
          )}
        </section>
      )}
    </div>
  );
}
