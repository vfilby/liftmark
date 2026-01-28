# Agent Instructions

See **CLAUDE.md** for complete agent context and instructions.

This file exists for compatibility with tools that look for AGENTS.md.

> **Recovery**: Run `gt prime` after compaction, clear, or new session

Full context is injected by `gt prime` at session start.

## 🚨 CRITICAL RULES

**NEVER run `make release` or any release commands (`npm run release:*`, `make release-*`, etc.) without explicit user instruction.**

Releases are sensitive operations that:
- Create git tags
- Deploy to app stores 
- Affect production systems
- Should only be triggered by humans who understand the implications

Always ask the user before running any release-related commands.
