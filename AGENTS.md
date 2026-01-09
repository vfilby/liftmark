# Agent Notes for LiftMark

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
