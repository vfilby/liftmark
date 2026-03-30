# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest release | Yes |
| Older releases | No |

Only the most recent release receives security updates. Users should always update to the latest version.

## Reporting a Vulnerability

Please report security vulnerabilities through [GitHub's private vulnerability reporting](https://github.com/vfilby/LiftMark/security/advisories/new). This ensures the issue stays confidential until a fix is available.

**Do not** open a public issue for security vulnerabilities.

When reporting, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (if applicable)

## Scope

### In Scope

- **iOS app** -- authentication, data storage, network communication, HealthKit integration
- **LMWF validator service** -- input validation, API security
- **LiftMark Workout Format spec** -- parsing vulnerabilities, injection risks

### Out of Scope

- Vulnerabilities in third-party dependencies (report these upstream)
- Issues requiring physical access to an unlocked device
- Social engineering attacks
- Denial of service against the TestFlight beta

## Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial assessment**: Within 7 days
- **Fix for critical issues**: Within 30 days
- **Fix for non-critical issues**: Best effort, typically within 90 days

This is a small-team project, so timelines are best-effort. We will keep you informed of progress.

## Recognition

Security researchers who responsibly disclose vulnerabilities will be acknowledged in the release notes for the version containing the fix, unless they prefer to remain anonymous.
