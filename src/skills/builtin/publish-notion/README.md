# Notion Publishing Skill

Publish stories and content to Notion from letta-code using `/publish-notion`.

## Quick Setup

### 1. Install dependencies

```bash
cd letta-code
bun add @notionhq/client
```

### 2. Get Notion credentials

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name (e.g., "Letta Publisher")
4. Copy the **Integration Token**

### 3. Create a Notion database

1. Create a new database in Notion
2. Add these properties (optional but recommended):
   - **Name** (title) - automatically created
   - **Type** (select) - for categorizing content
   - **Generated** (date) - when it was published
   - **Excerpt** (text) - preview of content
   - **Genre** (text) - story genre
   - **Year** (number) - target year for sci-fi
3. Click "Share" → Add your integration
4. Copy the database ID from the URL:
   ```
   https://notion.so/workspace/DATABASE_ID?v=...
                              ^^^^^^^^^^^^
   ```

### 4. Configure environment variables

Edit `letta-code/.env`:

```bash
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5. Test it

```bash
cd letta-code/src/skills/builtin/publish-notion/scripts
echo "# Test Story\n\nThis is a test." | bun publish.ts -
```

## Usage in letta-code

Once set up, just type `/publish-notion` in letta-code and the agent will know how to publish stories to Notion!

### Examples

**User:** "I have a story in ~/worlds/story.txt, can you publish it to Notion?"

**Agent:** Uses the publish-notion skill to run:
```bash
bun publish.ts ~/worlds/story.txt --type "Story" --genre "sci-fi" --year 2050
```

**User:** "/publish-notion publish this story: [content]"

**Agent:** Creates a temp file and publishes it with appropriate metadata.

## Legacy Compatibility

This skill is based on `.legacy/scripts/publish_to_notion.py` and maintains compatibility with the same Notion database schema.
