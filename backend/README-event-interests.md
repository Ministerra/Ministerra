# Event Interests Processing Architecture

### Socket.IO sticky setup

-   HTTP API on `BE_PORT` (default 2208)
-   Sticky Socket.IO on `SOCKET_PORT` (default `BE_PORT+1`, e.g., 2209)

Frontend env example:

```bash
VITE_BACK_END=http://localhost:2208
VITE_SOCKET_STICKY=http://localhost:2209
```

If using a TLS proxy, map the sticky port accordingly and point `VITE_SOCKET_STICKY` to that URL.

## Overview

This document explains the updated architecture for processing event interests in the application. The changes were made to eliminate duplicate processing and ensure that alerts are sent only after database updates are successful.

## Previous Architecture

Previously, event interests were processed by two separate handlers:

1. **userInteractionsHandler**: Processed event interests along with other user interactions, updated database records, and recalculated user and event metadata.
2. **eventInterestsHandler**: Read from the same Redis stream and called `processEventInterestsAlerts` to send alerts.

This approach had several issues:

-   Duplicate processing of the same Redis stream
-   Inconsistent acknowledgment mechanisms
-   Potential for data loss or duplicate processing
-   Unnecessary complexity

## New Architecture

The new architecture integrates the alert logic directly into the `userInteractionsHandler`:

1. **Single Source of Truth**: The `userInteractionsHandler` now processes event interests and sends alerts.
2. **Atomic Operations**: Database updates and alerts happen together in a single transaction.
3. **Simplified Processing Sequence**: The `eventInterestsHandler` has been removed from the `masterContentWorker`.

## Implementation Details

### Changes Made:

1. **userInteractionsHandler.js**:

    - Added import for `processEventInterestsAlerts` from `eventInterestsEmitter.js`
    - Added collection of event interests for alert during processing
    - Added `processEventAlerts` function to send alerts
    - Added call to `processEventAlerts` after database updates but before final commit
    - Added return value with processing metrics

2. **masterContentWorker.js**:
    - Removed import for `eventInterestsHandler`
    - Removed `eventInterests` from the handler mapping

### Data Processing Sequence:

1. Event interests are added to the `newEveInters` Redis stream
2. `userInteractionsHandler` reads from the stream using consumer groups
3. Event interests are processed and stored for alert
4. Database updates are performed
5. Alerts are sent using `processEventInterestsAlerts`
6. Changes are committed and the stream is acknowledged

## Benefits

-   **Efficiency**: Eliminates duplicate stream processing
-   **Reliability**: Ensures alerts are only sent for successfully processed interests
-   **Simplicity**: Reduces code complexity and maintenance burden
-   **Consistency**: Provides a single source of truth for event interest processing

## Future Considerations

-   Consider implementing a more robust error handling mechanism for alerts
-   Add metrics collection for alert processing
-   Consider implementing a retry mechanism for failed alerts
