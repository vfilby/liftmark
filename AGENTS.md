# Agent Notes for LiftMark

## Platform
iOS (iPhone) React Native + TypeScript, future Android. Light/dark mode, mobile-first, high test coverage.

## Core Features
1. Workout Import (LLM-friendly text/Markdown), 2. In-Workout Tracking (set completion + timers), 3. History (workouts + exercise progress)

## Development
- **Logs**: `tail -100 logs/expo.log` or `make logs-tail` (don't start Expo yourself)
- **Quality Gate**: `npm run ci` before committing (audit, typecheck, test)
- **Native Modules**: Need rebuild - use `make rebuild-ios`

## Session Completion (MANDATORY)
1. File issues for remaining work, 2. Run quality gates if code changed, 3. Update issue status
4. **PUSH**: `git pull --rebase && bd sync && git push` - Work NOT complete until pushed
5. Verify `git status` shows "up to date with origin"
