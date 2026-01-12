# Docker Metro POC - Isolated Metro Servers with Dynamic Port Mapping

## Overview

This POC demonstrates running Expo Metro bundler in Docker containers with dynamic host port mapping. This enables:
- **Port conflict resolution**: Multiple Metro servers on different ports
- **Process isolation**: Each Metro server runs in its own container
- **Parallel development**: Multiple agents working simultaneously without interference

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Host Machine                                   │
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │ iOS Simulator│      │ iOS Simulator│        │
│  │              │      │              │        │
│  │ Dev Build    │      │ Dev Build    │        │
│  │ Port 54100───┼──┐   │ Port 54101───┼──┐     │
│  └──────────────┘  │   └──────────────┘  │     │
│                    │                      │     │
│  ┌─────────────────▼───┐  ┌──────────────▼────┐│
│  │ Docker Container 1  │  │ Docker Container 2││
│  │                     │  │                   ││
│  │ Metro :8081         │  │ Metro :8081       ││
│  │   ▲                 │  │   ▲               ││
│  │   │ Volume mount    │  │   │ Volume mount  ││
│  └───┼─────────────────┘  └───┼───────────────┘│
│      │                        │                 │
│  ┌───▼────────────────────────▼───────────────┐ │
│  │   Project Source Code (/app)              │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker Desktop installed and running
- Node.js and npm installed
- Xcode and iOS Simulator (for iOS testing)

### Testing the POC

#### Step 1: Build iOS Dev Client for Docker Metro

Build the development client configured to connect to Metro on a specific host port:

```bash
./scripts/build-for-docker.sh 54100
```

This command:
1. Sets `EXPO_PACKAGER_PROXY_URL=http://host.docker.internal:54100`
2. Builds iOS dev client with that configuration
3. Installs on simulator

**Note**: You need to rebuild the dev client each time you change the port.

#### Step 2: Start Metro in Docker

In a separate terminal, start Metro in a Docker container:

```bash
./scripts/docker-metro.sh 54100
```

This command:
1. Builds the Docker image `liftmark-metro`
2. Starts a container mapping host port 54100 → container port 8081
3. Mounts the project directory as a volume
4. Starts Metro bundler

#### Step 3: Launch App

The app should already be installed on the simulator from Step 1. Simply launch it from the simulator, and it should connect to the containerized Metro server.

**Expected behavior:**
- App connects to Metro on port 54100
- Metro logs show bundle requests
- Hot reload works
- Native modules load correctly

## Running Multiple Metro Servers in Parallel

To test multiple isolated Metro servers (e.g., for parallel development):

### Terminal 1: Polecat 1
```bash
# Build dev client for port 54100
./scripts/build-for-docker.sh 54100

# Start Metro on port 54100
./scripts/docker-metro.sh 54100
```

### Terminal 2: Polecat 2
```bash
# Build dev client for port 54101
./scripts/build-for-docker.sh 54101

# Start Metro on port 54101
./scripts/docker-metro.sh 54101
```

### Terminal 3: Polecat 3
```bash
# Build dev client for port 54102
./scripts/build-for-docker.sh 54102

# Start Metro on port 54102
./scripts/docker-metro.sh 54102
```

Each Metro server runs in complete isolation without port conflicts.

## Test Checklist

Verify the following works correctly:

- [ ] **Build succeeds**: `./scripts/build-for-docker.sh 54100` completes without errors
- [ ] **Metro starts**: `./scripts/docker-metro.sh 54100` starts Metro in container
- [ ] **App connects**: iOS app connects to containerized Metro
- [ ] **Hot reload**: Changes to source files trigger app reload
- [ ] **Native modules**: HealthKit, Clipboard, Live Activities load correctly
- [ ] **No port conflicts**: Multiple containers can run on different ports (54100, 54101, 54102)
- [ ] **Volume mounting**: Changes to source code are immediately visible to Metro
- [ ] **Clean shutdown**: Ctrl+C stops container cleanly

## Troubleshooting

### Metro not connecting

**Symptom**: App shows "Unable to connect to Metro"

**Solutions**:
1. Verify Docker container is running: `docker ps`
2. Check port mapping is correct: `docker port <container-id>`
3. Ensure dev client was built with correct port: `./scripts/build-for-docker.sh <PORT>`
4. Check firewall isn't blocking Docker port mapping

### Port already in use

**Symptom**: Docker fails with "port is already allocated"

**Solution**: Choose a different port or stop the conflicting process:
```bash
# Find process using port
lsof -i :54100

# Kill process or use different port
./scripts/docker-metro.sh 54101
```

### Native modules not loading

**Symptom**: HealthKit, Clipboard, or Live Activities errors

**Solution**: This POC uses volume mounting, so native modules should work. If not:
1. Check that the ios/ directory exists and is properly built
2. Verify the dev client build includes all native dependencies
3. Try rebuilding: `make rebuild-ios`

### Docker build fails

**Symptom**: `docker build` fails during dependency installation

**Solutions**:
1. Ensure package.json and package-lock.json are present
2. Check Docker has internet access for npm packages
3. Try clearing Docker build cache: `docker build --no-cache -t liftmark-metro -f Dockerfile.metro .`

## Files Created

This POC adds the following files to the repository:

- **`Dockerfile.metro`** - Docker image definition for Metro server
- **`scripts/docker-metro.sh`** - Start Metro in Docker with port mapping
- **`scripts/build-for-docker.sh`** - Build dev client for specific port
- **`docs/DOCKER_METRO_POC.md`** - This documentation (usage instructions)

## Next Steps

After validating the POC works:

1. **Integrate with Makefile**: Add targets for Docker Metro workflow
2. **Optimize Docker image**: Multi-stage builds, layer caching
3. **Named simulators**: Integrate with existing polecat simulator workflow
4. **Documentation**: Update parallel-expo-workflow.md with Docker approach
5. **CI/CD**: Consider Docker-based builds for consistency

## Technical Details

### Port Mapping Strategy

- **Container port**: Always 8081 (Metro default)
- **Host port**: Dynamic (54100-54199 range)
- **Mapping**: `-p HOST_PORT:8081` in docker run command

### Volume Mounting

```bash
-v $(pwd):/app
```

This mounts the project directory into the container, allowing Metro to:
- Access source files
- Watch for changes (hot reload)
- Use existing node_modules (shared with host)

### Environment Variables

- **`EXPO_PACKAGER_PROXY_URL`**: Tells dev client where to find Metro
  - Format: `http://host.docker.internal:PORT`
  - Must match the port used in docker-metro.sh

### Why host.docker.internal?

On macOS, `host.docker.internal` is a special DNS name that resolves to the host machine's IP address from within a Docker container. This allows the iOS simulator (running on the host) to connect to Metro (running in Docker container).

## Limitations & Considerations

1. **Rebuild required**: Dev client must be rebuilt when changing ports
2. **Platform-specific**: `host.docker.internal` is macOS/Windows only (Linux uses different approach)
3. **Volume performance**: File watching may be slower on macOS due to volume mount overhead
4. **Build time**: Initial Docker image build takes ~1-2 minutes
5. **Disk space**: Each container uses ~500MB

## Success Criteria

This POC is successful if:
- ✅ Metro runs in container without port conflicts
- ✅ Dev build connects to Metro via mapped port
- ✅ Hot reload works correctly
- ✅ Native modules load (HealthKit, Clipboard, Live Activities)
- ✅ Multiple containers can run simultaneously on different ports
- ✅ Documentation is clear enough for manual testing

## Feedback & Testing

Please test this POC and report:
1. Did the build succeed?
2. Did Metro start in Docker?
3. Did the app connect successfully?
4. Does hot reload work?
5. Do native modules load?
6. Any errors or issues encountered?

Your feedback will inform the full implementation of Docker-isolated Metro servers for parallel development workflows.
