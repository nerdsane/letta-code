/**
 * Test script for canvas_ui tool
 * Run with: bun run test-canvas-ui.ts
 */

import { canvas_ui } from './src/tools/canvas_ui';

async function testCanvasUI() {
  console.log('🧪 Testing canvas_ui tool...\n');

  // Test 1: Create a simple dialog
  console.log('Test 1: Creating a dialog with visualization...');
  const result = await canvas_ui({
    target: 'floating',
    spec: {
      type: 'Dialog',
      id: 'test-viz-dialog',
      props: {
        title: '🚀 Story Timeline Visualization',
        description: 'This UI was created by the agent via canvas_ui tool!',
        trigger: {
          type: 'Button',
          id: 'viz-trigger',
          props: {
            label: '📊 View Agent-Created UI',
            variant: 'primary',
          },
        },
      },
      children: {
        type: 'Stack',
        props: { spacing: 20 },
        children: [
          {
            type: 'Text',
            props: {
              content: '✅ Agent Bus Communication Working!',
              variant: 'heading',
              size: 'lg',
              color: 'var(--neon-cyan)',
            },
          },
          {
            type: 'Text',
            props: {
              content: 'The agent successfully sent this UI component through the Agent Bus.',
              size: 'md',
              color: 'var(--text-primary)',
            },
          },
          {
            type: 'Text',
            props: {
              content: '🎨 Components: Dialog, Button, Text, Stack',
              size: 'sm',
              color: 'var(--text-secondary)',
            },
          },
          {
            type: 'Text',
            props: {
              content: '🔄 Bidirectional: Canvas interactions will flow back to agent',
              size: 'sm',
              color: 'var(--text-secondary)',
            },
          },
          {
            type: 'Text',
            props: {
              content: '🎯 Next: Agent can create inline story visualizations!',
              size: 'sm',
              color: 'var(--neon-magenta)',
            },
          },
        ],
      },
    },
    action: 'create',
  });

  console.log('Result:', result);
  console.log('\n✨ Check the canvas at http://localhost:3030');
  console.log('   You should see a new button appear!');

  // Keep the connection alive for a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

testCanvasUI().catch(console.error);
