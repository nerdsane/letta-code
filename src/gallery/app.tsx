import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { World, Story, StorySegment } from "../types/dsf";
import "./styles.css";

// ============================================================================
// ASCII Art Logo
// ============================================================================

const ASCII_LOGO = `██████╗ ███████╗███████╗██████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗
██║  ██║█████╗  █████╗  ██████╔╝
██║  ██║██╔══╝  ██╔══╝  ██╔═══╝
██████╔╝███████╗███████╗██║
╚═════╝ ╚══════╝╚══════╝╚═╝
███████╗ ██████╗██╗      ███████╗██╗
██╔════╝██╔════╝██║      ██╔════╝██║
███████╗██║     ██║█████╗█████╗  ██║
╚════██║██║     ██║╚════╝██╔══╝  ██║
███████║╚██████╗██║      ██║     ██║
╚══════╝ ╚═════╝╚═╝      ╚═╝     ╚═╝`;

// ============================================================================
// Types
// ============================================================================

type View = "gallery" | "world" | "story";

interface AppState {
  view: View;
  worlds: World[];
  stories: Story[];
  selectedWorld: World | null;
  selectedStory: Story | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  const [state, setState] = useState<AppState>({
    view: "gallery",
    worlds: [],
    stories: [],
    selectedWorld: null,
    selectedStory: null,
    loading: true,
    error: null,
  });

  // WebSocket connection for live updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "reload") {
        console.log("Reloading data...");
        loadData();
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => ws.close();
  }, []);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));

      const [worldsRes, storiesRes] = await Promise.all([
        fetch("/api/worlds"),
        fetch("/api/stories"),
      ]);

      const worlds = await worldsRes.json() as World[];
      const stories = await storiesRes.json() as Story[];

      setState((s) => ({
        ...s,
        worlds,
        stories,
        loading: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error instanceof Error ? error.message : "Failed to load data",
        loading: false,
      }));
    }
  }

  function selectWorld(world: World) {
    setState((s) => ({
      ...s,
      view: "world",
      selectedWorld: world,
    }));
  }

  function selectStory(story: Story) {
    setState((s) => ({
      ...s,
      view: "story",
      selectedStory: story,
    }));
  }

  function goBack() {
    if (state.view === "story") {
      setState((s) => ({ ...s, view: "world" }));
    } else if (state.view === "world") {
      setState((s) => ({ ...s, view: "gallery", selectedWorld: null }));
    }
  }

  function goHome() {
    setState((s) => ({
      ...s,
      view: "gallery",
      selectedWorld: null,
      selectedStory: null,
    }));
  }

  if (state.loading) {
    return <LoadingScreen />;
  }

  if (state.error) {
    return <ErrorScreen error={state.error} onRetry={loadData} />;
  }

  return (
    <div className="app">
      <Header
        view={state.view}
        selectedWorld={state.selectedWorld}
        selectedStory={state.selectedStory}
        onBack={goBack}
        onHome={goHome}
      />

      <main className="main-content">
        {state.view === "gallery" && (
          <GalleryView
            worlds={state.worlds}
            stories={state.stories}
            onSelectWorld={selectWorld}
            onSelectStory={selectStory}
          />
        )}

        {state.view === "world" && state.selectedWorld && (
          <WorldView
            world={state.selectedWorld}
            stories={state.stories.filter(
              (s) => s.world_checkpoint === getWorldCheckpointName(state.selectedWorld!)
            )}
            onSelectStory={selectStory}
          />
        )}

        {state.view === "story" && state.selectedStory && (
          <StoryView story={state.selectedStory} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header({
  view,
  selectedWorld,
  selectedStory,
  onBack,
  onHome,
}: {
  view: View;
  selectedWorld: World | null;
  selectedStory: Story | null;
  onBack: () => void;
  onHome: () => void;
}) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" onClick={onHome}>
          <pre className="logo-ascii">
{`██████╗ ███████╗███████╗██████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗
██║  ██║█████╗  █████╗  ██████╔╝
██║  ██║██╔══╝  ██╔══╝  ██╔═══╝
██████╔╝███████╗███████╗██║
╚═════╝ ╚══════╝╚══════╝╚═╝
███████╗ ██████╗██╗      ███████╗██╗
██╔════╝██╔════╝██║      ██╔════╝██║
███████╗██║     ██║█████╗█████╗  ██║
╚════██║██║     ██║╚════╝██╔══╝  ██║
███████║╚██████╗██║      ██║     ██║
╚══════╝ ╚═════╝╚═╝      ╚═╝     ╚═╝`}
          </pre>
        </div>
        {view !== "gallery" && (
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>

      <nav className="breadcrumb">
        <span className="breadcrumb-item" onClick={onHome}>
          Gallery
        </span>
        {selectedWorld && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item">
              {getWorldTitle(selectedWorld)}
            </span>
          </>
        )}
        {selectedStory && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-item">{selectedStory.metadata.title}</span>
          </>
        )}
      </nav>
    </header>
  );
}

// ============================================================================
// Gallery View
// ============================================================================

function GalleryView({
  worlds,
  stories,
  onSelectWorld,
  onSelectStory,
}: {
  worlds: World[];
  stories: Story[];
  onSelectWorld: (world: World) => void;
  onSelectStory: (story: Story) => void;
}) {
  const activeStories = stories.filter((s) => s.metadata.status === "active");

  return (
    <div className="gallery-view">
      <section className="section">
        <h2 className="section-title">Worlds ({worlds.length})</h2>
        <div className="worlds-grid">
          {worlds.length === 0 ? (
            <EmptyState message="No worlds yet. Create one in Letta Code!" />
          ) : (
            worlds.map((world) => (
              <WorldCard
                key={getWorldCheckpointName(world)}
                world={world}
                onClick={() => onSelectWorld(world)}
              />
            ))
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Active Stories ({activeStories.length})</h2>
        <div className="stories-list">
          {activeStories.length === 0 ? (
            <EmptyState message="No active stories. Start writing!" />
          ) : (
            activeStories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={() => onSelectStory(story)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// World View
// ============================================================================

function WorldView({
  world,
  stories,
  onSelectStory,
}: {
  world: World;
  stories: Story[];
  onSelectStory: (story: Story) => void;
}) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function handleNewStory() {
    try {
      const checkpoint = getWorldCheckpointName(world);
      const response = await fetch(`/api/world/${checkpoint}/new-story`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as { message?: string; context_file?: string };
      setActionMessage(result.message || "Context created! Run letta-code to write a story in this world.");

      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      console.error("Error creating story context:", error);
      setActionMessage(`Error: ${error instanceof Error ? error.message : "Failed to create context"}`);
      setTimeout(() => setActionMessage(null), 5000);
    }
  }

  async function handleDevelopWorld() {
    try {
      const checkpoint = getWorldCheckpointName(world);
      const response = await fetch(`/api/world/${checkpoint}/develop`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as { message?: string; context_file?: string };
      setActionMessage(result.message || "Context created! Run letta-code to develop this world further.");

      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      console.error("Error creating development context:", error);
      setActionMessage(`Error: ${error instanceof Error ? error.message : "Failed to create context"}`);
      setTimeout(() => setActionMessage(null), 5000);
    }
  }

  return (
    <div className="world-view">
      <div className="world-header">
        <div className="world-meta">
          {world.year && <span className="world-year">{world.year}</span>}
          <span className="world-version">v{world.development.version}</span>
          <span className="world-state">{world.development.state}</span>
        </div>
        <p className="world-premise">{world.foundation.core_premise}</p>
      </div>

      <div className="world-actions">
        <button className="action-button action-button-primary" onClick={handleNewStory}>
          Write Story in This World
        </button>
        <button className="action-button action-button-secondary" onClick={handleDevelopWorld}>
          Develop World Further
        </button>
      </div>

      {actionMessage && (
        <div className="action-message">
          {actionMessage}
        </div>
      )}

      <div className="world-content">
        <section className="world-section">
          <h3 className="subsection-title">Rules ({world.foundation.rules.length})</h3>
          <div className="rules-list">
            {world.foundation.rules.map((rule) => (
              <div key={rule.id} className="rule-item">
                <span className="rule-certainty">{rule.certainty}</span>
                <span className="rule-statement">{rule.statement}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="world-section">
          <h3 className="subsection-title">
            Characters & Elements ({world.surface.visible_elements.length})
          </h3>
          <div className="elements-list">
            {world.surface.visible_elements.map((element) => (
              <div key={element.id} className="element-item">
                <div className="element-header">
                  <span className="element-type">{element.type}</span>
                  {element.name && <span className="element-name">{element.name}</span>}
                </div>
                <p className="element-description">{element.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="world-section">
          <h3 className="subsection-title">Stories ({stories.length})</h3>
          <div className="stories-list">
            {stories.length === 0 ? (
              <EmptyState message="No stories in this world yet" />
            ) : (
              stories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onClick={() => onSelectStory(story)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Story View
// ============================================================================

function StoryView({ story }: { story: Story }) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(story.segments.length - 1);

  const segment = story.segments[activeSegmentIndex];

  async function handleContinue() {
    try {
      const response = await fetch("/api/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_id: story.id,
          segment_id: segment?.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as {
        message?: string;
        next_steps?: string[];
        context_file?: string;
      };

      const steps = result.next_steps?.join('\n') || '';
      alert(
        `✓ Story continuation context created!\n\n` +
        `${result.message || ''}\n\n` +
        `Next steps:\n${steps}\n\n` +
        `Context file: ${result.context_file || ''}`
      );
    } catch (error) {
      alert(`Failed to create continuation context:\n\n${error}`);
    }
  }

  return (
    <div className="story-view">
      <div className="story-header">
        <div className="story-meta">
          <span className="story-status">{story.metadata.status}</span>
          <span className="story-segments">{story.segments.length} segments</span>
          <span className="story-world">
            World: {story.world_checkpoint} (v{story.world_version})
          </span>
        </div>
      </div>

      {story.segments.length === 0 ? (
        <EmptyState message="No segments yet" />
      ) : (
        <>
          <div className="segment-nav">
            {story.segments.map((seg, index) => (
              <button
                key={seg.id}
                className={`segment-nav-button ${index === activeSegmentIndex ? "active" : ""}`}
                onClick={() => setActiveSegmentIndex(index)}
              >
                Segment {index + 1}
              </button>
            ))}
          </div>

          {segment && (
            <div className="segment-content">
              <div className="segment-header">
                <h3 className="segment-id">{segment.id}</h3>
                <span className="segment-word-count">{segment.word_count} words</span>
              </div>

              {segment.assets && segment.assets.length > 0 && (
                <div className="segment-assets">
                  {segment.assets.map((asset) => (
                    <div key={asset.id} className="asset-item">
                      {asset.type === "image" && (
                        <img
                          src={`/assets/${asset.path}`}
                          alt={asset.description || "Story asset"}
                          className="asset-image"
                        />
                      )}
                      {asset.description && (
                        <p className="asset-description">{asset.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="segment-text">{segment.content}</div>

              {segment.world_evolution && (
                <div className="world-evolution">
                  <h4>World Evolution</h4>
                  {segment.world_evolution.rules_applied && segment.world_evolution.rules_applied.length > 0 && (
                    <div className="evolution-item">
                      <strong>Rules Applied:</strong> {segment.world_evolution.rules_applied.join(", ")}
                    </div>
                  )}
                  {segment.world_evolution.elements_introduced && segment.world_evolution.elements_introduced.length > 0 && (
                    <div className="evolution-item">
                      <strong>Elements Introduced:</strong> {segment.world_evolution.elements_introduced.join(", ")}
                    </div>
                  )}
                  {segment.world_evolution.new_questions && segment.world_evolution.new_questions.length > 0 && (
                    <div className="evolution-item">
                      <strong>New Questions:</strong>
                      <ul>
                        {segment.world_evolution.new_questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {segment.branches && segment.branches.length > 0 && (
                <div className="branches">
                  <h4>Story Branches</h4>
                  {segment.branches.map((branch) => (
                    <div key={branch.id} className="branch-item">
                      <span className="branch-status">{branch.status}</span>
                      <span className="branch-prompt">{branch.prompt}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeSegmentIndex === story.segments.length - 1 && (
                <div className="story-actions">
                  <button className="continue-button" onClick={handleContinue}>
                    Continue Story →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Card Components
// ============================================================================

function WorldCard({ world, onClick }: { world: World; onClick: () => void }) {
  return (
    <div className="world-card" onClick={onClick}>
      {world.asset && (
        <div className="world-card-image-container">
          <img
            src={`/api/assets/${world.asset.path}`}
            alt={world.asset.description || "World cover"}
            className="world-card-image"
          />
        </div>
      )}
      <div className="world-card-header">
        <h3 className="world-card-title">{getWorldTitle(world)}</h3>
        <div className="world-card-badges">
          {world.year && <span className="world-card-year">{world.year}</span>}
          <span className="world-card-version">v{world.development.version}</span>
        </div>
      </div>
      <p className="world-card-premise">{world.foundation.core_premise}</p>
      <div className="world-card-footer">
        <span className="world-card-state">{world.development.state}</span>
        <span className="world-card-rules">{world.foundation.rules.length} rules</span>
        <span className="world-card-elements">
          {world.surface.visible_elements.length} elements
        </span>
      </div>
    </div>
  );
}

function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const totalWords = story.segments.reduce((sum, seg) => sum + seg.word_count, 0);

  return (
    <div className="story-card" onClick={onClick}>
      <div className="story-card-header">
        <h3 className="story-card-title">{story.metadata.title}</h3>
        <span className="story-card-status">{story.metadata.status}</span>
      </div>
      <div className="story-card-meta">
        <span>World: {story.world_checkpoint}</span>
        <span>{story.segments.length} segments</span>
        <span>{totalWords} words</span>
      </div>
      {story.metadata.tags && story.metadata.tags.length > 0 && (
        <div className="story-card-tags">
          {story.metadata.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Loading Deep Sci-Fi...</p>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="error-screen">
      <h2>Error Loading Data</h2>
      <p>{error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWorldTitle(world: World): string {
  // Try to extract a title from the premise or use the first element name
  if (world.surface?.visible_elements && world.surface.visible_elements.length > 0 && world.surface.visible_elements[0]?.name) {
    return world.surface.visible_elements[0].name;
  }

  // Use first few words of premise
  const premise = world.foundation?.core_premise || "Untitled World";
  const words = premise.split(" ").slice(0, 5);
  return words.join(" ") + (words.length < premise.split(" ").length ? "..." : "");
}

function getWorldCheckpointName(world: World): string {
  // Try to derive checkpoint name from world data
  // This is a heuristic - ideally the world would store its own checkpoint name
  const premise = world.foundation?.core_premise || "";
  return premise
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 30) || "unnamed_world";
}

// ============================================================================
// App Initialization
// ============================================================================

if (typeof document !== "undefined") {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    // Clear loading content
    rootElement.innerHTML = '';

    const root = createRoot(rootElement);
    root.render(<App />);
  }
}
