# Agent Notes for LiftMark

## Platform & Technology
- **Platform**: iOS (iPhone), future Android support
- **Framework**: React Native with TypeScript
- **Testing**: High test coverage required

## Core Features
1. **Workout Import**: LLM-friendly text/Markdown format
2. **In-Workout Tracking**: Set completion + timers (rest/duration)
3. **History**: Track workouts and exercise progress

## Development Standards
- Support light/dark mode, mobile-first (no web), comprehensive tests with accessibility
- Clean, modular code with proper error handling
- GitHub Actions CI/CD, EAS Build, TestFlight distribution

## Development Environment

### Expo Logs
The Expo dev server runs with logging to `logs/expo.log`. To check logs:
- **DO NOT** try to start Expo yourself - it's already running
- **DO** use `tail -100 logs/expo.log` or `make logs-tail` to view logs
- See `Makefile` lines 42-46 for the logging setup

### Quality Gate
Run `npm run ci` before committing. This runs:
- `npm audit --audit-level=high`
- `npm run typecheck`
- `npm run test`

### Native Modules
When adding native modules (like `react-native-health`), remember:
- They require rebuilding the dev client
- Use `make prebuild` to generate native projects
- Use `make rebuild-native` to clean and regenerate all native projects
- Use `make rebuild-ios` to prebuild and run on iOS simulator
- They won't work in Expo Go
- User must test on device after rebuild

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
