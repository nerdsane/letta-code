# Contributing to Deep Sci-Fi

## Fork the repo

Fork the repository on GitHub by [clicking this link](https://github.com/sesh/letta-code/fork), then clone your fork:

```bash
git clone https://github.com/your-username/letta-code.git
cd letta-code
```

## Installing from source

Requirements:
* [Bun](https://bun.com/docs/installation)

### Run directly from source (dev workflow)
```bash
# install deps
bun install

# run the CLI from TypeScript sources (pick up changes immediately)
bun run dev
bun run dev -- -p "Hello world"  # example with args
```

### Build + link the standalone binary
```bash
# build bin/deep-scifi (includes prompts + schemas)
bun run build

# expose the binary globally (adjust to your preference)
bun link

# now you can run the compiled CLI
deep-scifi
```

Whenever you change source files, rerun `bun run build` before using the linked `deep-scifi` binary so it picks up your edits.
