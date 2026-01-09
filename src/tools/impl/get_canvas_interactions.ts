/**
 * get_canvas_interactions - Agent tool for reading user interactions from canvas
 *
 * Allows agents to poll for user interactions with canvas UI components.
 * Interactions are queued when users click buttons, select options, etc.
 */

import type { QueuedInteraction } from "./canvas_ui";
import { getCanvasInteractions, peekCanvasInteractions } from "./canvas_ui";

interface GetInteractionsArgs {
  /** If true, don't clear the queue (just peek) */
  peek?: boolean;
  /** Filter by component ID */
  componentId?: string;
  /** Filter by interaction type (e.g., 'click', 'action') */
  interactionType?: string;
}

interface GetInteractionsResult {
  toolReturn: string;
  status: "success" | "error";
  interactions: QueuedInteraction[];
  count: number;
}

/**
 * Get pending user interactions from the canvas.
 *
 * Call this to see what buttons users have clicked, actions they've selected,
 * or other interactions with your UI components. By default, reading clears
 * the queue - set peek=true to look without clearing.
 */
export async function get_canvas_interactions(
  args: GetInteractionsArgs = {},
): Promise<GetInteractionsResult> {
  const { peek = false, componentId, interactionType } = args;

  try {
    // Get interactions (either peek or consume)
    let interactions = peek
      ? peekCanvasInteractions()
      : getCanvasInteractions();

    // Apply filters if specified
    if (componentId) {
      interactions = interactions.filter((i) => i.componentId === componentId);
    }
    if (interactionType) {
      interactions = interactions.filter(
        (i) => i.interactionType === interactionType,
      );
    }

    const count = interactions.length;

    let resultMessage: string;
    if (count === 0) {
      resultMessage = "No pending interactions";
    } else if (count === 1) {
      const i = interactions[0];
      resultMessage = `1 interaction: ${i.interactionType} on ${i.componentId}${i.data?.actionId ? ` (action: ${i.data.actionId})` : ""}`;
    } else {
      resultMessage = `${count} pending interactions`;
    }

    return {
      toolReturn: resultMessage,
      status: "success",
      interactions,
      count,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      toolReturn: `Failed to get interactions: ${errorMsg}`,
      status: "error",
      interactions: [],
      count: 0,
    };
  }
}
