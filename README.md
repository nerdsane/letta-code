# Deep Sci-Fi

[![npm](https://img.shields.io/npm/v/@deep-scifi/deep-scifi.svg?style=flat-square)](https://www.npmjs.com/package/@deep-scifi/deep-scifi) [![Discord](https://img.shields.io/badge/discord-join-blue?style=flat-square&logo=discord)](https://discord.gg/letta)

Deep Sci-Fi is a memory-first coding harness, built on top of the Letta API. Instead of working in independent sessions, you work with a persisted agent that learns over time and is portable across models (Claude Sonnet/Opus, GPT-5, Gemini 3 Pro, GLM-4.6, and more).

**Read more about how to use Deep Sci-Fi on the [official docs page](https://docs.letta.com/letta-code).**

![](https://github.com/sesh/letta-code/blob/main/assets/letta-code-demo.gif)

## Get started
Install the package via [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm install -g @deep-scifi/deep-scifi
```
Navigate to your project directory and run `deep-scifi` (see various command-line options [on the docs](https://docs.letta.com/letta-code/commands)).

> [!NOTE]
>  By default, Deep Sci-Fi will connect to the [Letta Developer Platform](https://app.letta.com/) (includes a free tier), which you can connect to via OAuth or setting a `LETTA_API_KEY`. You can also connect it to a [self-hosted Letta server](https://docs.letta.com/letta-code/configuration#self-hosted-server) by setting `LETTA_BASE_URL`

## Philosophy
Deep Sci-Fi is built around long-lived agents that persist across sessions and improve with use. Rather than working in independent sessions, each session is tied to a persisted agent that learns.

**Claude Code / Codex / Gemini CLI** (Session-Based)
- Sessions are independent
- No learning between sessions
- Context = messages in the current session + `AGENTS.md`
- Relationship: Every conversation is like meeting a new contractor

**Deep Sci-Fi** (Agent-Based)
- Same agent across sessions
- Persistent memory and learning over time
- `/clear` resets the session (clears current in-context messages), but memory persists
- Relationship: Like having a coworker or mentee that learns and remembers

## Agent Memory & Learning
If you're using Deep Sci-Fi for the first time, you will likely want to run the `/init` command to initialize the agent's memory system:
```bash
> /init
```

Over time, the agent will update its memory as it learns. To actively guide your agents memory, you can use the `/remember` command:
```bash
> /remember [optional instructions on what to remember]
```
Deep Sci-Fi works with skills (reusable modules that teach your agent new capabilities in a `.skills` directory), but additionally supports [skill learning](https://www.letta.com/blog/skill-learning). You can ask your agent to learn a skill from it's current trajectory with the command:
```bash
> /skill [optional instructions on what skill to learn]
```

Read the docs to learn more about [skills and skill learning](https://docs.letta.com/letta-code/skills).

Community maintained packages are available for Arch Linux users on the [AUR](https://aur.archlinux.org/packages/letta-code):
```bash
yay -S letta-code # release
yay -S letta-code-git # nightly
yay -S letta-code-bin # prebuilt release
```

---

Made with 💜 in San Francisco
