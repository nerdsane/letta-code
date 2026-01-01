#!/usr/bin/env bun
/**
 * Test script for inline mount points
 *
 * This script tests agent-created UI rendering at inline locations
 * within story segments and world views.
 */

import WebSocket from "ws";

const AGENT_BUS_URL = "ws://localhost:8284/ws?type=agent";

interface CanvasUIMessage {
  type: "canvas_ui";
  action: "create" | "update" | "remove";
  target: string;
  componentId: string;
  spec: any;
}

async function testInlineMountPoints() {
  console.log("🧪 Testing inline mount points...");
  console.log(`Connecting to Agent Bus: ${AGENT_BUS_URL}`);

  const ws = new WebSocket(AGENT_BUS_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => {
      console.log("✓ Connected to Agent Bus");
      resolve();
    });
    ws.on("error", reject);
  });

  // Test 1: Story header visualization
  console.log("\n📍 Test 1: Story Header Mount Point");
  const headerMessage: CanvasUIMessage = {
    type: "canvas_ui",
    action: "create",
    target: "story_header",
    componentId: "test-story-header",
    spec: {
      type: "Stack",
      id: "test-story-header",
      props: {
        direction: "horizontal",
        spacing: 12,
      },
      children: [
        {
          type: "Text",
          props: {
            content: "📊 Story Metadata",
            variant: "caption",
            size: "sm",
            color: "var(--neon-cyan)",
          },
        },
        {
          type: "Button",
          props: {
            label: "View Timeline",
            variant: "secondary",
          },
        },
      ],
    },
  };
  ws.send(JSON.stringify(headerMessage));
  console.log("→ Sent UI to story_header mount point");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 2: Inline story segment visualization
  console.log("\n📍 Test 2: Story Segment Inline Mount Point");
  const segmentMessage: CanvasUIMessage = {
    type: "canvas_ui",
    action: "create",
    target: "story_segment_test123",
    componentId: "test-segment-viz",
    spec: {
      type: "Dialog",
      id: "test-segment-viz",
      props: {
        title: "Character Relationships",
        description: "Network of connections in this scene",
        trigger: {
          type: "Button",
          props: {
            label: "🕸️ View Relationships",
            variant: "primary",
          },
        },
      },
      children: {
        type: "Stack",
        props: { spacing: 16 },
        children: [
          {
            type: "Text",
            props: {
              content: "Alice ← knows → Bob",
              variant: "body",
              size: "md",
            },
          },
          {
            type: "Text",
            props: {
              content: "Bob ← trusts → Carol",
              variant: "body",
              size: "md",
            },
          },
          {
            type: "Text",
            props: {
              content: "Carol ← suspects → Alice",
              variant: "body",
              size: "md",
              color: "var(--neon-magenta)",
            },
          },
        ],
      },
    },
  };
  ws.send(JSON.stringify(segmentMessage));
  console.log("→ Sent UI to story_segment_test123 mount point");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 3: World overview mount point
  console.log("\n📍 Test 3: World Overview Mount Point");
  const worldMessage: CanvasUIMessage = {
    type: "canvas_ui",
    action: "create",
    target: "world_overview",
    componentId: "test-world-overview",
    spec: {
      type: "Stack",
      id: "test-world-overview",
      props: {
        direction: "vertical",
        spacing: 16,
      },
      children: [
        {
          type: "Text",
          props: {
            content: "🌍 World Statistics",
            variant: "heading",
            size: "lg",
            color: "var(--neon-cyan)",
          },
        },
        {
          type: "Stack",
          props: { direction: "horizontal", spacing: 24 },
          children: [
            {
              type: "Text",
              props: {
                content: "📖 Stories: 3",
                variant: "body",
                size: "md",
              },
            },
            {
              type: "Text",
              props: {
                content: "👥 Characters: 12",
                variant: "body",
                size: "md",
              },
            },
            {
              type: "Text",
              props: {
                content: "🗺️ Locations: 8",
                variant: "body",
                size: "md",
              },
            },
          ],
        },
      ],
    },
  };
  ws.send(JSON.stringify(worldMessage));
  console.log("→ Sent UI to world_overview mount point");

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 4: Story footer mount point
  console.log("\n📍 Test 4: Story Footer Mount Point");
  const footerMessage: CanvasUIMessage = {
    type: "canvas_ui",
    action: "create",
    target: "story_footer",
    componentId: "test-story-footer",
    spec: {
      type: "Button",
      id: "test-story-footer",
      props: {
        label: "📝 Continue Story",
        variant: "primary",
      },
    },
  };
  ws.send(JSON.stringify(footerMessage));
  console.log("→ Sent UI to story_footer mount point");

  console.log("\n✅ All test messages sent!");
  console.log("\nCheck the canvas at http://localhost:3030");
  console.log("You should see:");
  console.log("  - Story header visualization at top of story");
  console.log("  - Relationship dialog button inline with story segment");
  console.log("  - World statistics in world overview section");
  console.log("  - Continue button at bottom of story");

  ws.close();
  console.log("\n✓ WebSocket closed");
}

testInlineMountPoints().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
