# Parallel Expo Workflow for Multi-Agent Development

## Problem Statement

Gas Town's multi-agent workflow requires running multiple Expo dev servers in parallel (ports 54100-54199), with each polecat managing its own instance. The current issue is that iOS simulators connect to the last-used bundler URL, causing connection conflicts when multiple polecats are running simultaneously.

**Current Pain Points:**
- Multiple polecats run Expo on different ports
- iOS simulator connects to wrong Metro bundler (last-used port)
- Pressing 'i' in Metro CLI doesn't guarantee correct bundler connection
- Breaks parallel agent workflow

## Research Findings

### 1. Multiple Port Support

**Status: ✅ Fully Supported**

Expo CLI supports running multiple dev servers on different ports using the `--port` flag:

```bash
# Terminal 1
npx expo start --port 54100

# Terminal 2
npx expo start --port 54101

# Terminal 3
npx expo start --port 54102
```

The current Makefile already implements dynamic port allocation (54100-54199 range).

**Sources:**
- [How to use multiple iOS simulators at once with Expo CLI](https://amanhimself.dev/blog/switch-between-ios-simulators/)
- [How to simultaneously launch multiple instances of iOS simulator on Expo](https://dev.to/francesco/how-to-simultaneously-launch-multiple-instances-of-ios-simulator-on-expo-5111)
- [Run multiple React Native applications with their own iOS simulators](https://medium.com/@diptimaya.patra/run-multiple-react-native-applications-with-their-own-ios-simulators-5e72ea1ca6e7)

### 2. Multiple iOS Simulators

**Status: ✅ Supported with Caveats**

You can run multiple iOS simulators simultaneously, but Expo CLI behavior has important limitations:

**Key Findings:**
- Multiple simulators can be open at once
- Expo CLI **always targets the most recently opened simulator** by default
- Pressing `Shift + i` in Expo CLI presents a searchable list of all configured simulators
- Each simulator must be selected manually for each Metro bundler instance

**Workflow:**
1. Start Metro on port 54100
2. Open Simulator A, press `Shift + i`, select Simulator A
3. Start Metro on port 54101
4. Open Simulator B, press `Shift + i`, select Simulator B

**Known Issue:**
- The port specified with `expo start -p` may not be used correctly when quick-opening iOS simulator with the `i` command
- [GitHub Issue #4091](https://github.com/expo/expo-cli/issues/4091) - Running multiple `expo start` processes can cause packager configuration conflicts

**Sources:**
- [iOS Simulator - Expo Documentation](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo CLI - Expo Documentation](https://docs.expo.dev/more/expo-cli/)

### 3. Custom Schemes & Deep Linking

**Status: ⚠️ Requires Development Build**

Custom URI schemes can help differentiate between instances, but **only work with development builds**, not Expo Go.

**Current Configuration:**
- Scheme: `liftmark`
- Bundle ID: `com.eff3.liftmark`

**Potential Approach for Multiple Instances:**
Each polecat could use a variant scheme:
- `liftmark-polecat1://`
- `liftmark-polecat2://`
- `liftmark-polecat3://`

**Requirements:**
- Must use EAS development builds (not Expo Go)
- Each variant needs different bundle identifier
- Cold-launching a development build with an app-specific deep link is **not currently supported**
- Project must be already open in the development build for deep links to work

**Limitations:**
- Requires building separate development builds for each polecat
- Adds complexity to the build process
- Not practical for rapid development cycles

**Sources:**
- [Linking into your app - Expo Documentation](https://docs.expo.dev/linking/into-your-app/)
- [Deep Linking in React Native (Expo): A Complete Guide](https://medium.com/@shreyasdamase/deep-linking-in-react-native-expo-a-complete-guide-from-someone-who-just-spent-hours-debugging-38baeed51850)
- [Tools, workflows and extensions - Expo Documentation](https://docs.expo.dev/develop/development-builds/development-workflows/)

### 4. QR Code Workflow

**Status: ⚠️ Limited for Development Builds**

With development builds, there are two types of QR codes:
1. **Build Installation QR**: One-time scan to install the development build
2. **Metro Bundler QR**: Scan to connect to a specific Metro instance

**Key Findings:**
- When you launch a development build, it can auto-detect bundlers on the local network
- You can manually connect by scanning the Metro bundler's QR code
- The bundler QR code is different from the build installation QR code
- If Metro can't connect over Wi-Fi on Android, use `adb reverse tcp:8081 tcp:8081`

**Workflow for Multiple Bundlers:**
1. Each polecat runs Metro on different port
2. Each Metro instance displays unique QR code
3. User scans appropriate QR code to connect simulator/device to correct bundler

**Limitations:**
- Requires manual QR scanning for each connection
- iOS simulators can't scan QR codes natively
- More practical for physical devices than simulators

**Sources:**
- [Use a development build - Expo Documentation](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Run Your Expo App on a Physical Phone (with a Development Build)](https://medium.com/@cathylai_40144/run-your-expo-app-on-a-physical-phone-with-a-development-build-expo-54-expo-router-fa2adc796b7f)

### 5. Environment Variables

**Status: ℹ️ Limited Usefulness**

**`EXPO_DEVTOOLS_LISTEN_ADDRESS`:**
- Binds DevTools to a specific address
- Defaults to `localhost` if not set
- Primary use case: Docker environments or remote access
- Setting to `0.0.0.0` allows external connections
- Does **not** solve the bundler connection issue for multiple instances

**Example:**
```bash
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 expo start --port 54100
```

**Other Environment Variables:**
- `REACT_NATIVE_PACKAGER_HOSTNAME`: Can set the hostname for the packager
- Does not prevent simulator from connecting to wrong bundler

**Sources:**
- [GitHub PR #1253 - Option to choose devtools bind address](https://github.com/expo/expo-cli/pull/1253)
- [Environment variables in Expo - Expo Documentation](https://docs.expo.dev/guides/environment-variables/)

### 6. Multiple App Variants

**Status: ⚠️ Complex, Not Recommended for Development**

EAS supports multiple app variants with different bundle identifiers:
- `com.eff3.liftmark.dev`
- `com.eff3.liftmark.polecat1`
- `com.eff3.liftmark.polecat2`

**Requirements:**
- Separate app.config.js for each variant
- Separate EAS build profiles
- Multiple development builds on device/simulator
- Each variant can have its own custom scheme

**Limitations:**
- Requires building and installing multiple apps
- Significant build time overhead
- Not practical for rapid development iteration

**Sources:**
- [Configure multiple app variants - Expo Documentation](https://docs.expo.dev/tutorial/eas/multiple-app-variants/)

## Recommended Solution

Based on the research, the most practical solution for Gas Town's multi-agent workflow is:

### **Approach: Manual Simulator Selection with Port Isolation**

This approach leverages Expo CLI's existing functionality without requiring custom builds or complex configuration.

#### Implementation

**1. Current Makefile Port Allocation (Keep as-is)**

```makefile
EXPO_PORT := $(shell for p in $$(seq 54100 54199); do \
  lsof -i :$$p -sTCP:LISTEN >/dev/null 2>&1 || { echo $$p; break; }; done)
```

**2. Simulator Naming Convention**

Create named simulators for each polecat:
```bash
# Create simulators with descriptive names
xcrun simctl create "iPhone 15 Pro - Polecat 1" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro com.apple.CoreSimulator.SimRuntime.iOS-17-0
xcrun simctl create "iPhone 15 Pro - Polecat 2" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro com.apple.CoreSimulator.SimRuntime.iOS-17-0
xcrun simctl create "iPhone 15 Pro - Polecat 3" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro com.apple.CoreSimulator.SimRuntime.iOS-17-0
```

**3. Enhanced Makefile Commands**

Add simulator-specific targets:

```makefile
# Launch iOS with explicit simulator selection
ios-sim1:
	EXPO_PORT=54100 npx expo run:ios --device "iPhone 15 Pro - Polecat 1"

ios-sim2:
	EXPO_PORT=54101 npx expo run:ios --device "iPhone 15 Pro - Polecat 2"

ios-sim3:
	EXPO_PORT=54102 npx expo run:ios --device "iPhone 15 Pro - Polecat 3"
```

**4. Development Workflow**

For each polecat:

```bash
# Polecat 1
cd /path/to/polecat1/worktree
make server  # Auto-allocates port (e.g., 54100)
# In Metro CLI, press Shift+i, select "iPhone 15 Pro - Polecat 1"

# Polecat 2
cd /path/to/polecat2/worktree
make server  # Auto-allocates port (e.g., 54101)
# In Metro CLI, press Shift+i, select "iPhone 15 Pro - Polecat 2"
```

#### Advantages

✅ No custom builds required
✅ Uses existing Expo CLI functionality
✅ Simple to implement
✅ Works with current Makefile port allocation
✅ Clear visual separation (named simulators)
✅ Fast iteration cycles

#### Limitations

⚠️ Requires manual simulator selection per bundler
⚠️ User must remember which simulator goes with which polecat
⚠️ Expo CLI still targets most recent simulator by default

## Alternative Approaches (Not Recommended)

### Approach A: Multiple Development Builds with Custom Schemes

**Pros:**
- Each polecat has dedicated app
- True isolation between instances

**Cons:**
- Requires building N development builds
- Significant build time (5-10 min per build)
- Must install multiple apps on simulator
- Not practical for rapid development

### Approach B: Physical Devices with QR Codes

**Pros:**
- Each device scans QR code for correct bundler
- True physical isolation

**Cons:**
- Requires N physical iOS devices
- Expensive and impractical
- Not suitable for CI/CD or automated testing

## Testing Procedure

To validate the parallel workflow:

### Test 1: Basic Parallel Operation

```bash
# Terminal 1
cd polecat1/liftmark
make server  # Should get port 54100

# Terminal 2
cd polecat2/liftmark
make server  # Should get port 54101
```

**Expected:** Both Metro bundlers running on different ports

### Test 2: Simulator Connection

```bash
# In Terminal 1 Metro CLI
# Press Shift+i
# Select "iPhone 15 Pro - Polecat 1"
# Verify app loads and connects to port 54100

# In Terminal 2 Metro CLI
# Press Shift+i
# Select "iPhone 15 Pro - Polecat 2"
# Verify app loads and connects to port 54101
```

**Expected:** Each simulator connects to its intended bundler

### Test 3: Hot Reload Independence

```bash
# Make code change in polecat1
# Observe hot reload ONLY in Polecat 1 simulator

# Make code change in polecat2
# Observe hot reload ONLY in Polecat 2 simulator
```

**Expected:** Changes isolated to correct simulator

## Implementation Checklist

- [x] Document research findings
- [ ] Create named simulators for each polecat
- [ ] Add simulator-specific Makefile targets
- [ ] Document workflow in polecat onboarding
- [ ] Test with 2+ polecats running simultaneously
- [ ] Verify hot reload isolation
- [ ] Document troubleshooting steps

## Troubleshooting

### Issue: Simulator connects to wrong bundler

**Solution:**
1. Close all simulators
2. Restart Metro bundler
3. Open specific simulator using `Shift+i` selector
4. Verify connection by checking Metro logs

### Issue: Port conflict when starting Metro

**Solution:**
```bash
# Find and kill process on conflicting port
lsof -ti:54100 | xargs kill -9

# Restart Metro
make server
```

### Issue: Fast Refresh not working

**Solution:**
- Ensure simulator is connected to correct bundler
- Check Metro logs for connection status
- Restart Metro bundler if needed

## Future Improvements

### Short-term (Could Implement)
- Add `make list-sims` to show available simulators
- Add `make kill-all-sims` to clean up simulators
- Add port detection in Makefile to suggest available simulator

### Long-term (Requires Expo Changes)
- Request Expo CLI flag for "sticky" simulator selection
- Propose bundler connection UI in Expo DevTools
- Request deep link support for cold-launching development builds

## Conclusion

The recommended approach of **manual simulator selection with port isolation** provides the best balance of:
- Simplicity (no custom builds)
- Practicality (uses existing Expo features)
- Reliability (clear simulator naming)
- Maintainability (minimal configuration)

While it requires manual simulator selection per bundler instance, this is a reasonable tradeoff given the limitations of Expo CLI's current architecture. More automated solutions would require significant custom tooling or changes to Expo CLI itself.

---

**Research completed:** 2026-01-11
**Researcher:** furiosa (liftmark polecat)
**Reviewed sources:** 20+ Expo documentation pages, GitHub issues, and community articles
