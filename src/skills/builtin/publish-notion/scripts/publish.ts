#!/usr/bin/env bun

/**
 * Notion publisher for stories and content
 * Based on .legacy/scripts/publish_to_notion.py
 */

import { parseArgs } from "node:util";
import { Client } from "npm:@notionhq/client";

interface NotionBlock {
  object: string;
  type: string;
  [key: string]: any;
}

function extractTitle(text: string): string {
  const lines = text.trim().split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.substring(2).trim();
    }
    if (trimmed.length > 10) {
      return trimmed.substring(0, 100) + (trimmed.length > 100 ? "..." : "");
    }
  }
  return "Untitled";
}

function extractExcerpt(text: string, maxLength: number = 300): string {
  const lines = text.trim().split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.length > 50) {
      const excerpt = trimmed.substring(0, maxLength);
      return excerpt + (trimmed.length > maxLength ? "..." : "");
    }
  }
  return "Content from agent.";
}

function textToNotionBlocks(
  text: string,
  maxBlocks: number = 100,
): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = text.trim().split("\n");
  let currentParagraph: string[] = [];
  let blockCount = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0 && blockCount < maxBlocks) {
      const paraText = currentParagraph.join(" ").substring(0, 2000);
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: paraText } }],
        },
      });
      currentParagraph = [];
      blockCount++;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle headings
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      if (blockCount < maxBlocks) {
        const headingText = trimmed.substring(2).trim().substring(0, 2000);
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: headingText } }],
          },
        });
        blockCount++;
      }
    }
    // Handle horizontal rules
    else if (trimmed.startsWith("---")) {
      flushParagraph();
      if (blockCount < maxBlocks) {
        blocks.push({
          object: "block",
          type: "divider",
          divider: {},
        });
        blockCount++;
      }
    }
    // Handle empty lines (paragraph break)
    else if (!trimmed) {
      flushParagraph();
    }
    // Regular text
    else {
      currentParagraph.push(trimmed);
      // Flush if getting too long
      if (currentParagraph.join(" ").length > 1800) {
        flushParagraph();
      }
    }
  }

  // Flush any remaining text
  flushParagraph();

  return blocks;
}

async function publishToNotion(
  content: string,
  options: {
    title?: string;
    type?: string;
    genre?: string;
    year?: number;
    metadata?: Record<string, any>;
  },
) {
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken) {
    throw new Error(
      "NOTION_TOKEN not set. Get your token at https://www.notion.so/my-integrations",
    );
  }

  if (!databaseId) {
    throw new Error(
      "NOTION_DATABASE_ID not set. Create a database and share it with your integration.",
    );
  }

  const notion = new Client({ auth: notionToken });

  // Extract or use provided title
  const title = options.title || extractTitle(content);
  const excerpt = extractExcerpt(content);

  // Build page properties
  const properties: any = {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    Generated: {
      date: { start: new Date().toISOString() },
    },
    Excerpt: {
      rich_text: [{ type: "text", text: { content: excerpt } }],
    },
  };

  // Add optional properties
  if (options.type) {
    properties.Type = { select: { name: options.type } };
  }

  if (options.genre) {
    properties.Genre = {
      rich_text: [{ type: "text", text: { content: options.genre } }],
    };
  }

  if (options.year) {
    properties.Year = { number: options.year };
  }

  // Add custom metadata
  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      const propName = key.charAt(0).toUpperCase() + key.slice(1);
      if (typeof value === "number") {
        properties[propName] = { number: value };
      } else {
        properties[propName] = {
          rich_text: [{ type: "text", text: { content: String(value) } }],
        };
      }
    }
  }

  // Convert content to Notion blocks
  const children = textToNotionBlocks(content);

  // Create the page
  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    children,
  });

  return {
    title,
    url: (response as any).url,
  };
}

// CLI handling
async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      title: { type: "string" },
      type: { type: "string" },
      genre: { type: "string" },
      year: { type: "string" },
      metadata: { type: "string" },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error("Usage: bun publish.ts <file|-> [options]");
    console.error("\nOptions:");
    console.error("  --title     Custom title");
    console.error("  --type      Content type (Story, Note, Research)");
    console.error("  --genre     Story genre");
    console.error("  --year      Target year");
    console.error('  --metadata  JSON metadata (e.g. \'{"key": "value"}\')');
    process.exit(1);
  }

  const filePath = positionals[0];

  // Read content
  let content: string;
  if (filePath === "-") {
    // Read from stdin
    content = await Bun.stdin.text();
  } else {
    content = await Bun.file(filePath).text();
  }

  // Parse metadata
  let metadata: Record<string, any> | undefined;
  if (values.metadata) {
    try {
      metadata = JSON.parse(values.metadata);
    } catch (e) {
      console.error("Invalid metadata JSON:", e);
      process.exit(1);
    }
  }

  // Publish
  try {
    const result = await publishToNotion(content, {
      title: values.title,
      type: values.type,
      genre: values.genre,
      year: values.year ? parseInt(values.year, 10) : undefined,
      metadata,
    });

    console.log("✓ Successfully published to Notion!");
    console.log(`  Title: ${result.title}`);
    console.log(`  URL: ${result.url}`);
  } catch (error) {
    console.error("✗ Error publishing to Notion:", error);
    process.exit(1);
  }
}

main();
