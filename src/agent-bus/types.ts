/**
 * Agent Bus - Message Protocol
 *
 * Bidirectional communication between Agent/CLI and Canvas UI
 */

import type { ComponentSpec } from '../canvas/components/types';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Agent → Canvas: Create or update UI components
 */
export interface CanvasUIMessage {
  type: 'canvas_ui';
  action: 'create' | 'update' | 'remove';
  target: string; // Mount point: 'story_segment_123', 'world_overview', 'floating'
  componentId: string; // Unique ID for this component
  spec?: ComponentSpec; // The UI component spec (omit for 'remove')
}

/**
 * Canvas → Agent: User interaction events
 */
export interface InteractionMessage {
  type: 'interaction';
  componentId: string;
  interactionType: string; // 'click', 'dialog_change', 'input_change', etc.
  data: any;
  target?: string; // Optional callback handler name from spec
}

/**
 * Connection lifecycle messages
 */
export interface ConnectionMessage {
  type: 'connect' | 'disconnect';
  clientType: 'agent' | 'canvas';
  clientId: string;
}

/**
 * Error messages
 */
export interface ErrorMessage {
  type: 'error';
  error: string;
  details?: any;
}

/**
 * Union of all message types
 */
export type AgentBusMessage =
  | CanvasUIMessage
  | InteractionMessage
  | ConnectionMessage
  | ErrorMessage;

// ============================================================================
// Client Connection Info
// ============================================================================

export interface AgentBusClient {
  id: string;
  type: 'agent' | 'canvas';
  ws: any; // WebSocket instance
  connectedAt: Date;
}
