# Feature Specification: PS2 Network Library Sharing

**Feature Branch**: `005-ps2-network-transfer`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Add network-based game transfer to PS2 as a new feature for OPL Forge. Today OPL Forge only manages games on locally-mounted USB/HDD devices. We want to let users send PS2/PS1 games and apps to a network-connected PS2 running Open PS2 Loader, without needing to physically move the storage drive between the PS2 and the PC. OPL acts as a network client that connects out to a share (not a server that accepts incoming pushes), so the likely architecture is: OPL Forge hosts a local network sharing service exposing the local game library, and the PS2's OPL connects to it as a client to browse/launch games directly. Scope covers enabling/configuring the sharing service from the UI, exposing the existing local library (DVD/CD/PS1/APPS folders), basic status indication of whether the service is running and whether a PS2 is connected, and safety considerations (local-network only, explicit start/stop)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Enable Library Sharing for a Network-Connected PS2 (Priority: P1)

**As a** PS2 owner whose console is connected to my home network and running Open PS2 Loader,
**I want to** turn on library sharing from OPL Forge and see the exact details I need to enter on my PS2,
**So that** I can browse and launch my games directly on the PS2 without ever removing my USB/HDD drive from my PC.

**Why this priority**: This is the core value of the feature — without it, nothing else in this spec matters. It replaces the current mandatory workflow of physically moving a storage drive between the PC and the PS2.

**Independent Test**: Can be fully tested by turning sharing on from OPL Forge, entering the displayed connection details into a PS2's OPL network menu, and confirming the PS2 can browse and boot a game from the shared library.

**Acceptance Scenarios**:

1. **Given** OPL Forge has a local game library configured, **When** the user turns on library sharing from the app for the first time, **Then** the app prompts the user to set a username and password for the share, requires the user to explicitly acknowledge that the PS2 will be able to create, modify, and overwrite files in the local library (separate from setting credentials), starts the sharing service, and displays the connection details (protocol, address, share/service name, credentials) needed to configure the PS2.
2. **Given** library sharing is on, **When** the user opens the in-app guided tutorial, **Then** it walks them step-by-step through entering the matching protocol, address, port, share name, and credentials into their PS2's OPL network settings.
3. **Given** library sharing is on and the PS2 is configured with the matching details, **When** the user browses from the PS2, **Then** the PS2 lists the same PS2, PS1, and Apps titles visible in OPL Forge's local library.
4. **Given** library sharing is on, **When** the user turns it off from OPL Forge, **Then** the service stops immediately and the PS2 can no longer reach the library over the network.

---

### User Story 2 - See Connection & Sharing Status at a Glance (Priority: P2)

**As a** user who just enabled library sharing,
**I want** to see whether the sharing service is actually running and whether my PS2 is currently connected to it,
**So that** I know my setup worked before I walk over to my TV to try playing a game.

**Why this priority**: Directly addresses the confusion users hit today when a PS2's on-screen network status doesn't reliably reflect its real connection — status must come from the PC side instead. Without this, User Story 1 works but leaves users guessing.

**Independent Test**: Can be tested by starting the sharing service, confirming the app shows "Running" with no client connected, then connecting a PS2 and confirming the status updates to reflect an active client.

**Acceptance Scenarios**:

1. **Given** the sharing service is off, **When** the user views the sharing status, **Then** the app clearly shows it is off along with a single primary action to turn it on.
2. **Given** the sharing service is on and no PS2 is currently browsing it, **When** the user views the status, **Then** the app shows the service is running and idle (no active client).
3. **Given** a PS2 is actively browsing or has an open connection to the shared library, **When** the user views the status, **Then** the app shows an active connection indicator.
4. **Given** the sharing service fails to start (e.g., a conflicting service is already using the required address/port), **When** the user attempts to turn it on, **Then** the app shows a clear, human-readable explanation of why it failed and what to try next, instead of a raw technical error.

---

### User Story 3 - Keep Sharing Local and Under Explicit Control (Priority: P2)

**As a** privacy- and security-conscious user,
**I want** library sharing to stay confined to my local network and never start without my explicit action,
**So that** I don't accidentally expose my game library or PC to anything outside my home.

**Why this priority**: Directly follows Constitution Principle I (safety around sensitive operations) and Principle II (least privilege). Required for the feature to be trustworthy, though the app is still usable for a single trusted home network without every control in this story.

**Independent Test**: Can be tested by inspecting that the sharing service only responds to requests originating from the local network, is off after a fresh install/restart until the user turns it on, and stops cleanly when the app is closed or the user disables it.

**Acceptance Scenarios**:

1. **Given** a fresh install of OPL Forge, **When** the user opens the app for the first time, **Then** library sharing is off by default.
2. **Given** library sharing is on, **When** a request to the shared library arrives from outside the local network, **Then** the request is rejected.
3. **Given** library sharing is on, **When** the user closes OPL Forge, **Then** the sharing service stops.

---

### Edge Cases

- What happens when the user turns on sharing but the configured local library folder is empty or missing the expected OPL folder structure (`DVD`, `CD`, `PS1`, `APPS`)?
- What happens when two devices (e.g., two PS2s, or a PS2 and an unrelated network client) try to connect to the shared library at the same time?
- What happens if the PC's network connection drops or changes (e.g., switches Wi-Fi networks, sleeps/wakes) while a PS2 is actively browsing?
- How does the system handle a naming or address conflict with another sharing service already running on the same PC (e.g., an existing OS-level file-sharing service)?
- What happens if the user's PC and PS2 end up on different subnets (e.g., behind a secondary router) such that they cannot reach each other at the network level? The app should surface this as a network-reachability problem rather than a silent failure.
- What happens when the PS2 writes a save file or new content back to the shared library at the same time OPL Forge (or the user) is modifying the same file locally?
- What happens when the user enters the wrong username/password on the PS2 repeatedly — does the app show failed-authentication attempts, and is there any lockout or rate-limiting concern?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow the user to start and stop a local network library-sharing service from within OPL Forge's UI, with no external tools or manual configuration required.
- **FR-002**: The sharing service MUST support both SMB and FTP protocols to expose the local game library, so a PS2 running Open PS2 Loader can browse and launch titles from it as a client using whichever protocol the user's OPL build/menu expects.
- **FR-003**: The sharing service MUST expose the same PS2, PS1, and Apps content already visible in OPL Forge's local library view, reflecting additions/removals made through the app.
- **FR-004**: System MUST display, whenever sharing is on, the exact connection details (network address, share/service name, and any credentials) the user needs to enter on their PS2.
- **FR-005**: System MUST show the current sharing status (off / running-idle / running-connected) without requiring the user to check the PS2 itself.
- **FR-006**: System MUST reject connection attempts to the sharing service that do not originate from the local network.
- **FR-007**: Library sharing MUST be off by default and MUST require an explicit user action to start; it MUST stop when the user disables it or closes the app.
- **FR-008**: System MUST show a clear, human-readable explanation when the sharing service fails to start or is interrupted (e.g., address/port conflict, network change), instead of a raw technical error.
- **FR-009**: System MUST NOT rely on the PS2's own on-screen network settings display to determine or confirm connectivity, since that display is not always reliable; connection/status detection MUST be derived from the sharing service itself.
- **FR-010**: Access to the shared library MUST require a username and password that the user sets in OPL Forge and enters on the PS2's OPL network client settings for the matching protocol (SMB and/or FTP).
- **FR-011**: The shared library MUST support both read and write access from the PS2 — browsing and launching titles, and writing data back (e.g., save files, or content the PS2/OPL creates or updates in the shared folders).
- **FR-012**: System MUST provide a guided, step-by-step in-app tutorial showing the user exactly what to enter in their PS2's OPL network client settings (protocol, address, port, share/service name, username, password) for the currently active sharing configuration.
- **FR-013**: System MUST prevent data corruption when the PC and a connected PS2 attempt to modify the same file at the same time (e.g., via file locking, or by rejecting the conflicting write with a clear message to the user).
- **FR-014**: System MUST require the user to explicitly acknowledge, once before write access is first granted, that the PS2 will be able to create, modify, and overwrite files in the local library over the network. This acknowledgment is distinct from setting the share's username/password (Constitution Principle I: explicit confirmation before an operation that can overwrite data). Sharing MUST NOT start with write access enabled until this acknowledgment is on record.
- **FR-015**: System MUST reject invalid SMB/FTP credentials with a generic authentication-failure message that does not reveal whether the username or the password was incorrect.

### Key Entities _(include if feature involves data)_

- **SharingService**: Represents the local network sharing service instance. Attributes: status (off, starting, running-idle, running-connected, error), protocol, network address, share/service name, port, error message (if any), last started timestamp.
- **ConnectedClient**: Represents a device currently connected to or browsing the shared library. Attributes: client address, connected-since timestamp, activity state (idle, browsing, transferring/launching).
- **SharedLibraryConfig**: Represents the sharing configuration tied to the existing local library. Attributes: source folder path, exposed content types (PS2 DVD/CD, PS1, Apps), enabled protocols (SMB/FTP), username, password.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user with a PS2 already connected to their home network can go from "sharing off" to successfully browsing their library on the PS2 in under 5 minutes, without consulting external documentation.
- **SC-002**: 100% of the time the sharing service is running, the app's displayed status (idle vs. connected) matches the PS2's actual connection state within 10 seconds of a change.
- **SC-003**: 0% of connection attempts from outside the local network succeed in reaching the shared library.
- **SC-004**: When the sharing service fails to start, 100% of failures present a plain-language explanation rather than a raw error code or stack trace.
- **SC-005**: Library sharing is off after every fresh install and after every app restart unless the user has explicitly left it enabled, with 0 unintended automatic exposures.

## Assumptions

- The user's PS2 is already on the same local network as the PC running OPL Forge, and basic IP connectivity between them is a network prerequisite outside this feature's control (the app can surface reachability problems but cannot fix the user's router/network topology).
- OPL Forge continues to be the single source of truth for the local game library; the sharing service is a read/write path into that same library, not a separate copy.
- This feature runs alongside, and does not replace, the existing local USB/HDD-based workflow — both remain available.
- The feature targets a single trusted home network at a time (one PC sharing to one or more PS2 units on that network), not multi-network or remote-over-internet scenarios.
- Standard desktop OS firewall prompts (allowing the app to accept local network connections) are an acceptable and expected part of first-time setup.
- **Out of scope for v1**: automatically detecting and recovering from PC network changes while a PS2 is connected (interface changes, sleep/wake, switching Wi-Fi networks). If the PC's network changes, the user is expected to restart sharing manually; the app is not required to auto-rebind or preserve in-flight connections through such a change.
