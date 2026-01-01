## Logging System Overview

This document explains how our server writes logs, what files are created, and which knobs you can tweak. The goal is to give a clear picture even if you have never written logging code before.

### What the system does at a glance

-   Every action the application wants to record (errors, warnings, normal information, web requests) goes through one shared logging helper.
-   The helper enriches each log entry with useful context: timestamps, server name, process id, current request id, etc.
-   It writes logs both to the console (useful during development) and to rotating log files on disk.
-   It protects sensitive information (passwords, tokens) by redacting them automatically.
-   It can slow down repetitive debug messages, aggregate repeated errors, and sample noisy HTTP logs so disk usage stays under control.

### Where the log files live

-   By default, log files are kept inside a `logging/` folder next to the application.
-   You can override the folder by setting the `LOG_DIR` environment variable.
-   Inside that folder you will find persisted subfolders:
    -   `logging/alert/` – warnings and operator-actionable signals (`alert-%DATE%.log`).
    -   `logging/error/` – error-level events (`error-%DATE%.log`).
    -   `logging/slow/` – slow SQL + slow HTTP signals (`slow-%DATE%.log`).
-   File names include the date (e.g. `app-2025-01-15.log`). When a file exceeds the configured size (default 30 MB), Winston starts a fresh one and keeps old ones compressed. Retention periods can be adjusted through environment variables.

### Key helper pieces (human language)

#### `sharedFormat`

Mixes in common information to every log line: timestamp, host name, process id, service name, environment, trace id if a distributed trace is active, etc. You do not call it directly—it operates behind the scenes for every entry. When call-site capture is enabled (default for `error`, `warn`, and `info` levels) the formatter also records the file and line where the log originated.

#### `ensureEntry(info)`

Takes one raw log event and builds a tidy object with the fields you should expect in JSON log files: `timestamp`, `level`, `message`, optional fields like `module` or `requestId`, and a `meta` section with everything else. This keeps structure consistent regardless of which function created the log.

#### `createConsoleFormat()`

Defines the terminal output you see when running the app locally. Lines now follow a compact, structured shape:

```
2025-01-15T08:12:00.000Z ERROR backend/modules/chat.js:412 – createChat failed (requestId=abc123 userId=u1 chatID=42)
    request {"method":"POST","path":"/chat","ip":"203.0.113.5"}
    request.body {"mode":"createChat","chatID":42,"userID":"u1"}
    error.meta {"code":"ER_DUP_ENTRY"}
```

Each entry always leads with timestamp, level, and source file:line, followed by the human message. Key request fields (`requestId`, `userId`, `method`, `path`, `status`, `ip`, etc.) are inlined in parentheses to make scanning easy. Detailed request bodies, queries, and parameter payloads are indented on dedicated lines when present (and automatically redacted where needed). Error stacks render beneath the message and keep their indentation so the frames remain legible.

#### `createJsonFormat()`

Controls how log entries are written to files. Each line is a JSON object produced by `ensureEntry`, which makes searching and parsing simple for log collection tools.

#### `createLoggerInstance(...)`

Builds the actual reporters (“loggers”) for app, error, and access logs. It attaches the console output described above and connects a file writer that rolls over daily. You can configure levels, retention, file size, etc.

### Getting a logger for a module: `getLogger(name)`

-   Example: `const logger = getLogger('Chat');`
-   This returns an object with standard methods: `logger.debug`, `logger.info`, `logger.alert`, `logger.error`.
-   Calling those methods automatically tags the entry with `module: Chat`, and sends it through the pipeline described earlier.

### Additional helper loggers

-   `infoLogger`, `errorsLogger`, `accessLogger` provide the same abilities at a slightly lower level. Most code uses `getLogger` instead.
-   `infoLogger.debugModule/infoModule/warnModule` and `errorsLogger.errorModule` are convenience helpers when you only have the module name string at runtime.
-   `runWithLogContext`, `addToLogContext` allow us to store information (like request id) and have it flow into every log created during that request.

### Request logging middleware

-   The `requestLoggingMiddleware` attaches to Express HTTP traffic. For each request it logs a single summary when the response finishes: method, path, status, duration, user id, etc.
-   Request summaries are **debug-level** (not persisted), and are sampled via `LOG_HTTP_SAMPLE_RATE`. 5xx requests are still logged as **error** (persisted).

### Error aggregation (log volume control)

-   If `LOG_AGGREGATE_ERRORS=1`, repeated identical errors are grouped together.
-   The first occurrence logs immediately. Duplicates within a short window (default 5 seconds) are counted, and a summary entry adds `aggregation: { count, firstSeen, lastSeen, ... }`.
-   Limits: values only hold per process (i.e. per server instance). If we run multiple servers, each aggregates its own errors.

### Debug rate limiting

-   Setting `LOG_DEBUG_RATE_LIMIT` (e.g. `20/1000` for 20 messages per 1000 milliseconds) prevents individual modules from flooding debug logs.
-   It is per process and per module. Developers can bypass the limit by including `meta.__skipRateLimit = true`.

### Module-specific log levels

-   Environment variables like `LOG_LEVEL_CHAT=warn` force that module to output only warnings or above. There is also a `LOG_LEVEL_DEFAULT` fallback.
-   This helps silence noisy modules in production without changing code.

### HTTP log sampling

-   `LOG_HTTP_SAMPLE_RATE` accepts values between 0 and 1. Example: `0.1` means “emit only 10% of request summaries (debug-level).”
-   The sampled entries include `sampleRate` in their metadata so you know that only a portion of traffic is represented.

### Automatic call-site capture & request context

-   By default (`LOG_INCLUDE_CALLSITE` != `0`), every `error`, `warn`, and `info` log pinpoints the file/line where it was emitted. Adjust the list with `LOG_CALLSITE_LEVELS=error,warn,info,debug` or disable entirely via `LOG_INCLUDE_CALLSITE=0`.
-   If a log receives `req` (the Express request) in its metadata, the logger automatically extracts method, path, route, request id, user id, ip, params, query, and—on warnings/errors—the sanitized body. Those fields appear both in console output and JSON files without needing to duplicate mapping logic in every handler.
-   Console output emphasises the essentials on the first line; deeper structures (request payload, meta, stack traces) render underneath with consistent indentation so multi-line entries remain readable even during high traffic.

### Schema validation and redaction

-   Setting `LOG_VALIDATE_SCHEMA=1` makes the logger do a quick self-check on each entry to ensure it can be serialized cleanly.
-   Sensitive fields (passwords, tokens, cookies, etc.) are automatically replaced with `[REDACTED]` and nodes like `req`, `res`, `socket` are stripped out to avoid leaking huge objects.

### HOW log files look (examples)

**info/app logs** – each line is JSON such as:

```
{"timestamp":"2025-01-15T08:12:00.000Z","level":"info","message":"Chat created","module":"Chat","userId":"u1","meta":{"chatId":123}}
```

**error logs** – the same structure but include a serialized `error` block and optionally an `aggregation` block like:

```
{
  "timestamp": "2025-01-15T08:12:05.000Z",
  "level": "error",
  "message": "Chat.createChat",
  "module": "Chat",
  "error": {"name":"Error","message":"duplicate key", ... },
  "aggregation": {
    "count": 42,
    "firstSeen": "2025-01-15T08:12:00.000Z",
    "lastSeen": "2025-01-15T08:12:05.000Z",
    "reason": "count"
  }
}
```

**access logs** – a single line per HTTP request with fields like `method`, `path`, `status`, `duration`, optional `body` & `query`, `userAgent`, etc.

### Environment variables you can tune

-   `LOG_DIR`
-   `LOG_LEVEL`, `LOG_LEVEL_DEFAULT`, `LOG_LEVEL_<MODULE>` (e.g. `LOG_LEVEL_CHAT`, `LOG_LEVEL_AUTH`)
-   `LOG_DEBUG_RATE_LIMIT` (per-module debug limit)
-   `LOG_AGGREGATE_ERRORS`, `LOG_AGGREGATE_ERRORS_WINDOW_MS`, `LOG_AGGREGATE_ERRORS_MAX_COUNT`
-   `LOG_HTTP_SAMPLE_RATE` (between 0 and 1)
-   `LOG_HTTP_STDOUT` (mirror request summaries to console; backward compat: `LOG_ACCESS_STDOUT`)
-   `LOG_INCLUDE_CALLSITE` (toggle automatic file:line capture for console output)
-   `LOG_CALLSITE_LEVELS` (comma-separated list of levels that should capture call sites; defaults to `error,warn,info`)
-   `LOG_CONSOLE_COLORS` (set to `0` to disable level colouring in the console)
-   `LOG_INCLUDE_BODY_INFO` (set to `1` if you want request bodies included on `info` level logs; bodies are always captured for warnings/errors)

### When to expect new log files

-   Daily at midnight UTC the logger starts a fresh file (but keeps writing to the old one until rotation completes).
-   As soon as the size exceeds `LOG_MAX_SIZE`, it rolls to a new file immediately.
-   Compressed archives are kept for the configured retention period. After that they are deleted automatically.

### Summary

-   Logs are structured JSON with consistent fields.
-   You can control volume via environment variables (per-module levels, sampling, rate limits, aggregation).
-   Files are stored under `logging/` by default, one set per category (info/error/access) with automatic rotation and compression.
-   Sensitive information is redacted automatically.
-   Extra context (timestamps, file/line, request ids, request body) is added automatically, so you always know what went wrong, where, and with which payload.

That’s the whole picture in plain language. If you’re trying to find a particular log, look under the corresponding folder (`info`, `error`, or `access`), open the `*-YYYY-MM-DD.log` file, and read the JSON lines. Each line tells you what happened, when, and in which part of the application.
