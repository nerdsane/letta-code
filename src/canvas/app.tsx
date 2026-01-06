import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type { World, Story, StorySegment } from "../types/dsf";
import type { ComponentSpec } from "./components/types";
import "./styles.css";
import { DynamicRenderer } from "./components/DynamicRenderer";
import { MountPoint } from "./components/MountPoint";
import { AgentBusClient } from "./agentBusClient";
import { ImmersiveStoryReader } from "./components/story";
import { mockStory } from "./components/story/mockStory";
import { WorldSpace } from "./components/world";
import { WelcomeSpace } from "./components/welcome";
import { FeedbackProvider, useFeedbackSafe } from "./context/FeedbackContext";
import { ToastContainer, AgentStatus } from "./components/feedback";
import { FloatingInput, useFloatingInput, InteractiveElement, type ElementType } from "./components/interaction";
import { AgentSuggestions, type Suggestion } from "./components/agent";

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

type View = "canvas" | "world" | "story";

interface AgentUIEntry {
  componentId: string;
  spec: ComponentSpec;
  mode: 'overlay' | 'fullscreen' | 'inline';
}

interface AppState {
  view: View;
  worlds: World[];
  stories: Story[];
  selectedWorld: World | null;
  selectedStory: Story | null;
  loading: boolean;
  error: string | null;
  agentUI: Map<string, AgentUIEntry>; // Agent-created UI by target
  fullscreenUI: AgentUIEntry | null; // Fullscreen UI takes over main content
  agentBusConnected: boolean;
  showImmersiveDemo: boolean; // Toggle for immersive reader demo (mock data)
  agentThinking: boolean; // Agent is processing
  agentAction?: string; // What agent is currently doing
  useImmersiveWorld: boolean; // Use immersive WorldSpace view
}

// ============================================================================
// Polling Utility
// ============================================================================

async function waitForCondition(
  checkFn: () => Promise<boolean>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    onCheck?: (attempt: number) => void;
  } = {}
): Promise<boolean> {
  const { timeoutMs = 30000, intervalMs = 2000, onCheck } = options;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempt++;
    if (onCheck) onCheck(attempt);

    if (await checkFn()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  const [state, setState] = useState<AppState>({
    view: "canvas",
    worlds: [],
    stories: [],
    selectedWorld: null,
    selectedStory: null,
    loading: true,
    error: null,
    agentUI: new Map(),
    fullscreenUI: null,
    agentBusConnected: false,
    showImmersiveDemo: false,
    agentThinking: false,
    useImmersiveWorld: true, // Default to immersive experience
  });

  const agentBusRef = useRef<AgentBusClient | null>(null);
  const feedback = useFeedbackSafe();

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

  // ESC key handler for fullscreen and immersive modes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (state.fullscreenUI) {
          setState(s => ({ ...s, fullscreenUI: null }));
        } else if (state.showImmersiveDemo) {
          setState(s => ({ ...s, showImmersiveDemo: false }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.fullscreenUI, state.showImmersiveDemo]);

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
    // Send interaction to agent requesting immersive story experience
    if (agentBusRef.current && agentBusRef.current.isConnected()) {
      agentBusRef.current.sendInteraction(
        'canvas-story-request',
        'story_read_request',
        {
          storyId: story.id,
          title: story.metadata.title,
          segmentCount: story.segments.length,
          // Include story data for agent to compose experience
          story: story,
        },
        'story-experience'
      );
      // Show thinking state while agent composes experience
      setState((s) => ({
        ...s,
        agentThinking: true,
        selectedStory: story,
      }));
    } else {
      // Fallback to static view if agent bus not connected
      console.warn('[Canvas] Agent Bus not connected, using static story view');
      setState((s) => ({
        ...s,
        view: "story",
        selectedStory: story,
      }));
    }
  }

  function goBack() {
    if (state.view === "story") {
      setState((s) => ({ ...s, view: "world" }));
    } else if (state.view === "world") {
      setState((s) => ({ ...s, view: "canvas", selectedWorld: null }));
    }
  }

  function goHome() {
    setState((s) => ({
      ...s,
      view: "canvas",
      selectedWorld: null,
      selectedStory: null,
      showImmersiveDemo: false,
    }));
  }

  function toggleImmersiveDemo() {
    setState((s) => ({ ...s, showImmersiveDemo: !s.showImmersiveDemo }));
  }

  function handleDynamicUIInteraction(
    componentId: string,
    interactionType: string,
    data: any,
    target?: string
  ) {
    console.log('[Dynamic UI] Interaction:', {
      componentId,
      interactionType,
      data,
      target
    });

    // Send interaction to agent via Agent Bus
    if (agentBusRef.current && agentBusRef.current.isConnected()) {
      agentBusRef.current.sendInteraction(componentId, interactionType, data, target);
    } else {
      console.warn('[Canvas] Agent Bus not connected, interaction not sent');
    }
  }

  // Handle element context menu actions
  function handleElementAction(actionId: string, elementId: string, elementType: ElementType, elementData?: any) {
    console.log('[Canvas] Element action:', { actionId, elementId, elementType });

    // Send to agent via Agent Bus
    if (agentBusRef.current && agentBusRef.current.isConnected()) {
      agentBusRef.current.sendInteraction(
        `element-${elementType}-${elementId}`,
        `element_action`,
        {
          action: actionId,
          elementId,
          elementType,
          elementData,
          context: {
            view: state.view,
            worldId: state.selectedWorld ? getWorldCheckpointName(state.selectedWorld) : undefined,
            storyId: state.selectedStory?.id,
          },
        },
        'agent'
      );

      // Show feedback
      feedback?.showToast(`Action: ${actionId}`, 'agent');
      setState(s => ({ ...s, agentThinking: true, agentAction: `Processing ${actionId}...` }));
    } else {
      feedback?.showToast('Agent not connected', 'warning');
    }
  }

  // Handle suggestion acceptance
  function handleSuggestionAccept(suggestion: Suggestion) {
    console.log('[Canvas] Suggestion accepted:', suggestion);

    if (agentBusRef.current && agentBusRef.current.isConnected()) {
      agentBusRef.current.sendInteraction(
        `suggestion-${suggestion.id}`,
        'suggestion_accepted',
        {
          suggestion,
          context: {
            view: state.view,
            worldId: state.selectedWorld ? getWorldCheckpointName(state.selectedWorld) : undefined,
            storyId: state.selectedStory?.id,
          },
        },
        'agent'
      );

      feedback?.showToast(`Working on: ${suggestion.title}`, 'agent');
      setState(s => ({ ...s, agentThinking: true, agentAction: suggestion.action }));
    }
  }

  function handleSuggestionDismiss(suggestionId: string) {
    console.log('[Canvas] Suggestion dismissed:', suggestionId);
  }

  // Initialize Agent Bus connection
  useEffect(() => {
    const agentBus = new AgentBusClient({
      onCanvasUI: (componentId, target, action, spec, mode = 'overlay') => {
        setState((s) => {
          // Handle fullscreen mode - takes over main content
          if (mode === 'fullscreen') {
            if (action === 'remove') {
              return { ...s, fullscreenUI: null };
            } else if (spec) {
              // Clear thinking state when fullscreen experience arrives
              return { ...s, fullscreenUI: { componentId, spec, mode }, agentThinking: false };
            }
            return s;
          }

          // Handle overlay/inline modes - stored by target
          const newAgentUI = new Map(s.agentUI);

          if (action === 'remove') {
            newAgentUI.delete(target);
          } else if (spec) {
            newAgentUI.set(target, { componentId, spec, mode });
          }

          return { ...s, agentUI: newAgentUI };
        });
      },
      onStateChange: (event, data) => {
        console.log('[Canvas] State change:', event, data);

        // Handle state changes with soft refresh (no full page reload)
        switch (event) {
          case 'agent_thinking':
            setState(s => ({ ...s, agentThinking: true, agentAction: data.action }));
            feedback?.setAgentThinking(true, data.action);
            break;
          case 'agent_done':
            setState(s => ({ ...s, agentThinking: false, agentAction: undefined }));
            feedback?.setAgentThinking(false);
            break;
          case 'story_started':
            // Show toast and refresh data
            feedback?.showToast('New story created!', 'success');
            Promise.all([
              fetch('/api/stories').then(res => res.json()) as Promise<Story[]>,
              fetch('/api/worlds').then(res => res.json()) as Promise<World[]>,
            ]).then(([stories, worlds]) => {
              setState(prev => ({
                ...prev,
                stories,
                worlds,
                agentThinking: false,
              }));
            });
            break;
          case 'story_continued':
            // Show toast and refresh data
            feedback?.showToast('Story continued', 'agent');
            Promise.all([
              fetch('/api/stories').then(res => res.json()) as Promise<Story[]>,
              fetch('/api/worlds').then(res => res.json()) as Promise<World[]>,
            ]).then(([stories, worlds]) => {
              setState(prev => ({
                ...prev,
                stories,
                worlds,
                agentThinking: false,
              }));
            });
            break;
          case 'world_entered':
            // Show toast and refresh worlds data
            feedback?.showToast('World updated', 'agent');
            (fetch('/api/worlds').then(res => res.json()) as Promise<World[]>).then(worlds => {
              setState(prev => ({ ...prev, worlds, agentThinking: false }));
            });
            break;
          case 'image_generated':
            // Show toast and refresh to show new images
            feedback?.showToast('Image generated', 'success');
            Promise.all([
              fetch('/api/stories').then(res => res.json()) as Promise<Story[]>,
              fetch('/api/worlds').then(res => res.json()) as Promise<World[]>,
            ]).then(([stories, worlds]) => {
              setState(prev => ({
                ...prev,
                stories,
                worlds,
                agentThinking: false,
              }));
            });
            break;
        }
      },
      onConnect: (clientId) => {
        console.log('[Canvas] Connected to Agent Bus:', clientId);
        setState((s) => ({ ...s, agentBusConnected: true }));
      },
      onDisconnect: () => {
        console.log('[Canvas] Disconnected from Agent Bus');
        setState((s) => ({ ...s, agentBusConnected: false }));
      },
      onError: (error) => {
        console.error('[Canvas] Agent Bus error:', error);
      },
    });

    agentBus.connect();
    agentBusRef.current = agentBus;

    return () => {
      agentBus.disconnect();
    };
  }, [feedback]);

  if (state.loading) {
    return <LoadingScreen />;
  }

  if (state.error) {
    return <ErrorScreen error={state.error} onRetry={loadData} />;
  }

  // Show immersive demo mode (full-screen experience)
  if (state.showImmersiveDemo) {
    return (
      <ImmersiveStoryReader
        story={mockStory}
        onContinue={() => console.log('Continue story')}
        onBranch={(branchId) => console.log('Branch selected:', branchId)}
        onWorldExplore={() => {
          toggleImmersiveDemo();
        }}
      />
    );
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

      {/* Agent Bus UI components (overlay mode) */}
      {Array.from(state.agentUI.entries()).map(([target, { componentId, spec }]) => {
        // For now, render all components as floating (TODO: add proper mount points)
        return (
          <div
            key={componentId}
            data-target={target}
            style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 2001 }}
          >
            <DynamicRenderer
              spec={spec}
              onInteraction={handleDynamicUIInteraction}
            />
          </div>
        );
      })}

      {/* Fullscreen UI - takes over entire viewport */}
      {state.fullscreenUI && (
        <div
          className="fullscreen-ui"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'var(--bg-primary)',
            overflow: 'auto',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setState(s => ({ ...s, fullscreenUI: null }))}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 3001,
              padding: '8px 12px',
              background: 'rgba(10, 10, 10, 0.9)',
              border: '1px solid rgba(0, 255, 204, 0.3)',
              color: 'rgba(0, 255, 204, 0.8)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            ESC
          </button>
          <DynamicRenderer
            spec={state.fullscreenUI.spec}
            onInteraction={handleDynamicUIInteraction}
          />
        </div>
      )}

      {/* Agent status indicator */}
      <AgentStatus
        isThinking={state.agentThinking}
        action={state.agentAction}
      />

      <main className="main-content">
        {state.view === "canvas" && (
          <WelcomeSpace
            worlds={state.worlds}
            stories={state.stories}
            onSelectWorld={selectWorld}
            onSelectStory={selectStory}
            onElementAction={handleElementAction}
          />
        )}

        {state.view === "world" && state.selectedWorld && (
          state.useImmersiveWorld ? (
            <WorldSpace
              world={state.selectedWorld}
              stories={state.stories.filter(
                (s) => s.world_checkpoint === getWorldCheckpointName(state.selectedWorld!)
              )}
              onSelectStory={selectStory}
              onStartNewStory={() => {
                // Trigger new story creation
                const checkpoint = getWorldCheckpointName(state.selectedWorld!);
                fetch(`/api/world/${checkpoint}/new-story`, { method: 'POST' })
                  .then(() => window.location.reload())
                  .catch(console.error);
              }}
              onElementAction={handleElementAction}
            />
          ) : (
            <WorldView
              world={state.selectedWorld}
              stories={state.stories.filter(
                (s) => s.world_checkpoint === getWorldCheckpointName(state.selectedWorld!)
              )}
              onSelectStory={selectStory}
              agentUI={state.agentUI}
              onInteraction={handleDynamicUIInteraction}
            />
          )
        )}

        {state.view === "story" && state.selectedStory && (
          <StoryView
            story={state.selectedStory}
            agentUI={state.agentUI}
            onInteraction={handleDynamicUIInteraction}
            onElementAction={handleElementAction}
          />
        )}
      </main>

      {/* Agent Suggestions */}
      <AgentSuggestions
        world={state.selectedWorld}
        story={state.selectedStory}
        stories={state.stories}
        onAccept={handleSuggestionAccept}
        onDismiss={handleSuggestionDismiss}
        position="floating"
      />

      {/* Global toast notifications */}
      <ToastContainer />

      {/* Global floating input (Cmd/Ctrl+K) */}
      <FloatingInputWrapper agentBusRef={agentBusRef} currentView={state.view} />
    </div>
  );
}

// Floating input wrapper - needs to be separate to use hooks properly
function FloatingInputWrapper({
  agentBusRef,
  currentView,
}: {
  agentBusRef: React.MutableRefObject<AgentBusClient | null>;
  currentView: string;
}) {
  const floatingInput = useFloatingInput();

  const handleSendMessage = useCallback((message: string, context: any) => {
    if (agentBusRef.current && agentBusRef.current.isConnected()) {
      agentBusRef.current.sendInteraction(
        'floating-input',
        'user_message',
        {
          message,
          context: {
            ...context,
            view: currentView,
          },
        },
        'agent'
      );
    } else {
      console.warn('[Canvas] Agent Bus not connected, message not sent');
    }
  }, [agentBusRef, currentView]);

  return (
    <FloatingInput
      isVisible={floatingInput.isVisible}
      onSend={handleSendMessage}
      onClose={floatingInput.close}
      context={floatingInput.context}
      placeholder="Ask the agent anything... (Ctrl+K)"
    />
  );
}

// Wrapper to provide FeedbackContext
function AppWithFeedback() {
  return (
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
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
        {view !== "canvas" && (
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>

      <nav className="breadcrumb">
        <span className="breadcrumb-item" onClick={onHome}>
          Canvas
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
// Canvas View
// ============================================================================

function CanvasView({
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
    <div className="canvas-view">
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
  agentUI,
  onInteraction,
}: {
  world: World;
  stories: Story[];
  onSelectStory: (story: Story) => void;
  agentUI: Map<string, { componentId: string; spec: ComponentSpec }>;
  onInteraction: (componentId: string, interactionType: string, data: any, target?: string) => void;
}) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Helper to get components for a specific target
  const getComponentsForTarget = (target: string) => {
    const components = [];
    for (const [key, value] of agentUI.entries()) {
      if (key === target) {
        components.push(value);
      }
    }
    return components;
  };

  async function handleNewStory() {
    const initialStoryCount = stories.length;

    try {
      setIsWorking(true);
      setActionMessage("Asking agent to create story...");

      const checkpoint = getWorldCheckpointName(world);
      const response = await fetch(`/api/world/${checkpoint}/new-story`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json() as { status: string; message?: string };
      setActionMessage("Agent is creating story... checking for updates...");

      // POLL for new story
      const success = await waitForCondition(
        async () => {
          try {
            const storiesRes = await fetch(`/api/stories?world=${checkpoint}`);
            const updatedStories = (await storiesRes.json()) as Story[];
            return updatedStories.length > initialStoryCount;
          } catch {
            return false;
          }
        },
        {
          timeoutMs: 60000,
          intervalMs: 2000,
          onCheck: (attempt) => {
            setActionMessage(`Agent is creating story... (checking ${attempt})`);
          },
        }
      );

      if (success) {
        setActionMessage("✓ New story created! Refreshing...");
        window.location.reload(); // Reload page to show new story
      } else {
        setActionMessage("⚠ Timeout waiting for story. Try refreshing page.");
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (error) {
      console.error("Error creating story:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to create story";
      setActionMessage(`Error: ${errorMsg}`);
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDevelopWorld() {
    const initialVersion = world.development.version;

    try {
      setIsWorking(true);
      setActionMessage("Asking agent to develop world...");

      const checkpoint = getWorldCheckpointName(world);
      const response = await fetch(`/api/world/${checkpoint}/develop`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json() as { status: string; message?: string };
      setActionMessage("Agent is developing world... checking for updates...");

      // POLL for world version change
      const success = await waitForCondition(
        async () => {
          try {
            const worldsRes = await fetch("/api/worlds");
            const worlds = (await worldsRes.json()) as World[];
            const updatedWorld = worlds.find((w) => getWorldCheckpointName(w) === checkpoint);
            return (updatedWorld?.development.version || 0) > initialVersion;
          } catch {
            return false;
          }
        },
        {
          timeoutMs: 60000,
          intervalMs: 2000,
          onCheck: (attempt) => {
            setActionMessage(`Agent is developing world... (checking ${attempt})`);
          },
        }
      );

      if (success) {
        setActionMessage("✓ World updated! Refreshing...");
        window.location.reload(); // Reload page to show updated world
      } else {
        setActionMessage("⚠ Timeout waiting for update. Try refreshing page.");
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (error) {
      console.error("Error developing world:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to develop world";
      setActionMessage(`Error: ${errorMsg}`);
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setIsWorking(false);
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

      {/* Agent UI: World Header */}
      <MountPoint
        target="world_header"
        components={getComponentsForTarget("world_header")}
        onInteraction={onInteraction}
      />

      <div className="world-actions">
        <button
          className="action-button action-button-primary"
          onClick={handleNewStory}
          disabled={isWorking}
        >
          Write Story in This World
        </button>
        <button
          className="action-button action-button-secondary"
          onClick={handleDevelopWorld}
          disabled={isWorking}
        >
          Develop World Further
        </button>
      </div>

      {actionMessage && (
        <div className="action-message">
          {actionMessage}
        </div>
      )}

      {/* Agent UI: World Overview */}
      <MountPoint
        target="world_overview"
        components={getComponentsForTarget("world_overview")}
        onInteraction={onInteraction}
      />

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
// Markdown Renderer Component
// ============================================================================

function MarkdownContent({
  content,
  assets,
}: {
  content: string;
  assets?: StoryAsset[];
}) {
  // Simple markdown parser for images: ![description](asset_id)
  const renderMarkdown = (text: string) => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    // Match ![...](asset_id) or ![](asset_id)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = imageRegex.exec(text)) !== null) {
      // Add text before the image
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const altText = match[1] || "";
      const assetId = match[2];

      // Find the asset
      const asset = assets?.find((a) => a.id === assetId || a.path.includes(assetId));

      if (asset) {
        parts.push(
          <img
            key={`${assetId}-${match.index}`}
            src={`/assets/${asset.path}`}
            alt={altText || asset.description || "Story image"}
            className="inline-image"
            style={{ maxWidth: "100%", height: "auto", margin: "1rem 0" }}
          />
        );
      } else {
        // Asset not found, show placeholder
        parts.push(
          <span key={`missing-${assetId}-${match.index}`} className="missing-image">
            [Image: {altText || assetId}]
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  // Split by newlines to preserve paragraphs
  const paragraphs = content.split("\n\n");

  return (
    <div className="markdown-content">
      {paragraphs.map((para, i) => {
        const rendered = renderMarkdown(para);
        return (
          <p key={i} style={{ marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
            {rendered}
          </p>
        );
      })}
    </div>
  );
}

// ============================================================================
// Story View
// ============================================================================

function StoryView({
  story,
  agentUI,
  onInteraction,
  onElementAction,
}: {
  story: Story;
  agentUI: Map<string, { componentId: string; spec: ComponentSpec }>;
  onInteraction: (componentId: string, interactionType: string, data: any, target?: string) => void;
  onElementAction?: (actionId: string, elementId: string, elementType: ElementType, elementData?: any) => void;
}) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(story.segments.length - 1);
  const [continuingStory, setContinuingStory] = useState(false);
  const [continueMessage, setContinueMessage] = useState<string | null>(null);

  const segment = story.segments[activeSegmentIndex];

  // Helper to get components for a specific target
  const getComponentsForTarget = (target: string) => {
    const components = [];
    for (const [key, value] of agentUI.entries()) {
      if (key === target) {
        components.push(value);
      }
    }
    return components;
  };

  async function handleContinue() {
    const initialSegmentCount = story.segments.length;

    try {
      setContinuingStory(true);
      setContinueMessage("Asking agent to continue story...");

      const response = await fetch("/api/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_id: story.id,
          segment_id: segment?.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json() as {
        status: string;
        message?: string;
        story_id?: string;
        agent_response?: any;
      };

      setContinueMessage("Agent is writing... checking for updates...");

      // POLL for new segment
      const success = await waitForCondition(
        async () => {
          try {
            const storiesRes = await fetch("/api/stories");
            const stories = (await storiesRes.json()) as Story[];
            const updatedStory = stories.find((s) => s.id === story.id);
            return (updatedStory?.segments.length || 0) > initialSegmentCount;
          } catch {
            return false;
          }
        },
        {
          timeoutMs: 60000, // 60 seconds
          intervalMs: 2000, // Check every 2 seconds
          onCheck: (attempt) => {
            setContinueMessage(`Agent is writing... (checking ${attempt})`);
          },
        }
      );

      if (success) {
        setContinueMessage("✓ New segment added! Refreshing...");
        window.location.reload(); // Reload page to show new segment
      } else {
        setContinueMessage("⚠ Timeout waiting for segment. Try refreshing page.");
        setTimeout(() => {
          setContinuingStory(false);
          setContinueMessage(null);
        }, 5000);
      }
    } catch (error) {
      setContinuingStory(false);
      setContinueMessage(null);
      alert(`Failed to continue story:\n\n${error instanceof Error ? error.message : error}`);
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

      {/* Agent UI: Story Header */}
      <MountPoint
        target="story_header"
        components={getComponentsForTarget("story_header")}
        onInteraction={onInteraction}
      />

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
            <InteractiveElement
              elementType="story_segment"
              elementId={segment.id}
              elementData={segment}
              onAction={onElementAction || (() => {})}
            >
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

              {/* Agent UI: Before Segment Text */}
              <MountPoint
                target={`story_segment_${segment.id}_before`}
                components={getComponentsForTarget(`story_segment_${segment.id}_before`)}
                onInteraction={onInteraction}
              />

              <div className="segment-text">
                <MarkdownContent content={segment.content} assets={segment.assets} />
              </div>

              {/* Agent UI: After Segment Text */}
              <MountPoint
                target={`story_segment_${segment.id}`}
                components={getComponentsForTarget(`story_segment_${segment.id}`)}
                onInteraction={onInteraction}
              />

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
                  <button
                    className="continue-button"
                    onClick={handleContinue}
                    disabled={continuingStory}
                  >
                    {continuingStory ? "Agent is writing..." : "Continue Story →"}
                  </button>
                  {continueMessage && (
                    <div className="continue-message">
                      {continueMessage}
                    </div>
                  )}
                </div>
              )}
              </div>
            </InteractiveElement>
          )}
        </>
      )}

      {/* Agent UI: Story Footer */}
      <MountPoint
        target="story_footer"
        components={getComponentsForTarget("story_footer")}
        onInteraction={onInteraction}
      />
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
    root.render(<AppWithFeedback />);
  }
}
