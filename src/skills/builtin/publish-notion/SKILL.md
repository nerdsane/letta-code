---
name: publish-notion
description: Publish stories and content to a Notion database. Use when the user asks to publish, save, or export content to Notion. Handles story publishing with metadata like title, type, genre, and year.
---

# Publish to Notion

This skill publishes stories and other content to a Notion database.

## Prerequisites

1. **Install notion-client** (one time):
   ```bash
   cd letta-code
   bun add notion-client
   ```

2. **Set environment variables** in `letta-code/.env`:
   ```bash
   NOTION_TOKEN=your_integration_token_here
   NOTION_DATABASE_ID=your_database_id_here
   ```

   Get your token at: https://www.notion.so/my-integrations

## Usage

When the user asks to publish content to Notion, use the script:

```bash
cd letta-code/src/skills/builtin/publish-notion/scripts
bun publish.ts <content_file> [options]
```

### Options

- `--title "Custom Title"` - Set custom title (otherwise extracted from content)
- `--type "Story|Note|Research"` - Content type
- `--genre "sci-fi|fantasy|etc"` - Story genre
- `--year 2050` - Target year for sci-fi stories
- `--metadata '{"key": "value"}'` - Additional metadata as JSON

### Examples

```bash
# Publish a story file
bun publish.ts ~/worlds/story.txt --type "Story" --genre "sci-fi" --year 2050

# Publish with custom title
bun publish.ts content.md --title "My Research Notes" --type "Research"

# Publish from stdin
echo "Content here" | bun publish.ts - --type "Note"
```

## How It Works

1. Reads content from file or stdin
2. Extracts title from first heading or uses custom title
3. Converts markdown to Notion blocks
4. Creates page in configured Notion database with metadata
5. Returns URL to published page

## Database Schema

The Notion database should have these properties:
- **Name** (title) - Page title
- **Type** (select) - Content type
- **Generated** (date) - Publication date
- **Excerpt** (text) - Content preview
- **Genre** (text) - Optional genre
- **Year** (number) - Optional target year

You can add these properties to your database, or the script will work with whatever properties exist.
