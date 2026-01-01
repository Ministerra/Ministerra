# Socket.IO Module Structure

This directory contains the refactored Socket.IO implementation, split into focused, maintainable modules.

## File Structure

```
frontend/src/hooks/socketIO/
├── socketHandlers.js    (~510 lines) - Core socket infrastructure
├── chatsHandlers.js     (~280 lines) - Chat event handlers
├── alertsHandlers.js    (~340 lines) - Alerts event handlers
└── README.md            - This file
```

## Before Refactoring

**Old structure:**

-   `useSocketIO.js` - **1,228 lines** (monolithic)
    -   Mixed responsibilities (chats, alerts, connection management)
    -   Hard to navigate and maintain
    -   Difficult to test individual features

## After Refactoring

**New structure:**

-   `socketHandlers.js` - **~510 lines**

    -   Socket connection & lifecycle
    -   Authentication & token management
    -   Reconnection logic & backfill
    -   Watchdog for long-term stability
    -   Main `useSocketIO` hook

-   `chatsHandlers.js` - **~280 lines**

    -   `processMessage` - new/edit/delete message handling
    -   `handleRoomsRejoinedEvent` - room state sync
    -   `handleMembersChangedEvent` - member updates
    -   `handleUserLeftChat` - user left notification
    -   `handleNewChat` - new chat creation
    -   `handleChatPunishment` - ban/gag/kick handling
    -   `handleBlocking` - chat blocking
    -   `handleMessageSeen` - read receipts
    -   `reenterChat` - rejoin after punishment

-   `alertsHandlers.js` - **~340 lines**

    -   `handleUserEvent` - user data updates
    -   `handleLinksAndBlocksAlert` - link/unlink/block/unblock
    -   `handleInterestAlert` - event interest updates
    -   `handleInviteAlert` - event invitations (85 lines!)
    -   `handleRatingAlert` - rating updates (event/user/comment)
    -   `handleCommentsAlert` - new comments/replies
    -   Alert merging & deduplication
    -   Toast notifications

-   `useSocketIO.js` (old file) - **6 lines**
    -   Re-export for backward compatibility
    -   No breaking changes for existing code

## Benefits

### ✅ Single Responsibility

Each file has one clear purpose:

-   **socketHandlers**: "How do we connect to the socket?"
-   **chatsHandlers**: "What happens when chat events arrive?"
-   **alertsHandlers**: "What happens when alert events arrive?"

### ✅ Easier to Navigate

-   Working on chats? Open `chatsHandlers.js` (280 lines)
-   Working on alerts? Open `alertsHandlers.js` (340 lines)
-   No need to scroll through 1,228 lines

### ✅ Better Testability

```javascript
import { createChatsHandlers } from './chatsHandlers';

// Test just chat handlers in isolation
const handlers = createChatsHandlers({ brain, chats, setChats, ... });
await handlers.processMessage({ chatID: 123, message: {...} });
```

### ✅ Easier to Reuse

Handlers can be used in different contexts:

```javascript
// Use alerts handlers in a different hook
const alertsHandlers = createAlertsHandlers({ brain, setAlertsData, ... });
```

### ✅ No Breaking Changes

The old import path still works:

```javascript
import useSocketIO from '../hooks/useSocketIO'; // ✅ Still works!
```

## Usage

### Basic Usage (unchanged)

```javascript
import useSocketIO from '../hooks/useSocketIO';

function Chat() {
	const { socket } = useSocketIO({
		brain,
		thisIs: 'chats',
		setChats,
		chats,
		// ... other props
	});
}
```

### Advanced: Using Handlers Directly

```javascript
import { createChatsHandlers } from '../hooks/socketIO/chatsHandlers';

const handlers = createChatsHandlers({
	brain,
	chats,
	setChats,
	// ... other dependencies
});

// Use individual handlers
await handlers.processMessage(event);
```

## Key Features

### Smart Reconnection (from socketHandlers.js)

-   **5-minute state recovery window** (up from 2 minutes)
-   **Skip backfill for quick reconnects** (< 5 seconds)
-   Detailed logging of reconnection reasons

### Connection State Recovery Check

```javascript
const rec = globalSocket?.recovered;
const disconnectDuration = Date.now() - lastDisconnectTime;

if (!rec && disconnectDuration > 5000) {
	// Backfill only when necessary
	await backfillAlertsOnReconnect();
	await man({ mode: 'getChats', getNewest: true });
}
```

### Efficient Backfill

-   Chat backfill uses cursors (highest message ID)
-   Alert backfill dispatches event to alerts component
-   No redundant state tracking

## Testing the Refactoring

1. **Short disconnect** (< 5s):

    ```
    ✅ "Socket reconnected quickly (3s) - skipping backfill"
    ```

2. **Long disconnect** (> 5s):

    ```
    ✅ "Socket recovery failed (disconnected for 30s) - backfilling missed events"
    ```

3. **Verify chats still work**:

    - Send/receive messages
    - Join/leave rooms
    - Ban/unban users

4. **Verify alerts still work**:
    - Link requests
    - Event invites
    - Ratings & comments

## Future Improvements

-   [ ] Extract watchdog logic to separate file
-   [ ] Add unit tests for each handler module
-   [ ] Consider TypeScript for better type safety
-   [ ] Add JSDoc comments for handler functions

## Migration Notes

If you want to update imports to use the new structure directly:

```javascript
// Before
import useSocketIO from '../hooks/useSocketIO';

// After (optional, for clarity)
import useSocketIO from '../hooks/socketIO/socketHandlers';
```

Both approaches work! The old path re-exports for backward compatibility.
