#!/usr/bin/env node
/**
 * LOG VIEWER CLI
 * Steps: resolve log directory by type, locate newest file, print the last N lines
 * parsed as JSON when possible (with colored levels), then keep polling for growth
 * to emulate a tiny `tail -f` without needing platform-specific flags.
 *
 * Usage: npm run logs [alert|error|slow] [lines]
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import colors from 'colors/safe.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_BASE = path.resolve(__dirname, '../../logging');

// CLI ARG PARSING --------------------------------------------------------------
// Steps: accept [type] and [lines], defaulting to alert/100 so the tool is usable with zero args.
const TYPE = process.argv[2] || 'alert'; // alert, error, slow
const LINES = parseInt(process.argv[3]) || 100;

const DIRS = {
	alert: path.join(LOG_BASE, 'alert'),
	error: path.join(LOG_BASE, 'error'),
	slow: path.join(LOG_BASE, 'slow'),
};

const FILENAMES = {
	alert: 'alert',
	error: 'error',
	slow: 'slow',
};

// LEVEL COLORING ---
// Steps: map log level to a stable color so scanning output becomes visual rather than textual.
const LEVEL_COLORS = {
	error: colors.red,
	alert: colors.yellow,
	info: colors.cyan,
	debug: colors.blue,
};

// LATEST FILE RESOLUTION ---
// Steps: list files, filter by prefix+suffix, sort newest-last naming, then pick the newest.
async function findLatestLogFile(dir, prefix) {
	try {
		const files = await fs.promises.readdir(dir);
		const relevant = files
			.filter(f => f.startsWith(prefix) && f.endsWith('.log'))
			.sort()
			.reverse();
		return relevant[0] ? path.join(dir, relevant[0]) : null;
	} catch (e) {
		return null;
	}
}

// META FORMATTING ---
// Steps: strip known “header” fields, then serialize the remainder as key=value pairs for a compact tail view.
function formatMeta(meta) {
	const parts = [];
	for (const [key, val] of Object.entries(meta)) {
		if (key === 'timestamp' || key === 'level' || key === 'message' || key === 'error') continue;

		let valStr = '';
		if (typeof val === 'object') valStr = JSON.stringify(val);
		else valStr = String(val);

		parts.push(`${colors.gray(key)}=${valStr}`);
	}
	return parts.join(' ');
}

// LINE RENDERING ---
// Steps: try JSON parse (structured logs), format timestamp+level+message, append meta, then optionally expand error stacks;
// if parse fails, emit raw line so corrupt/non-JSON content is still visible in-stream.
function prettyPrint(line) {
	try {
		if (!line.trim()) return;
		const data = JSON.parse(line);

		const timestamp = new Date(data.timestamp).toLocaleTimeString();
		const levelColor = LEVEL_COLORS[data.level] || colors.white;
		const level = levelColor(data.level.toUpperCase().padEnd(5));
		const msg = data.message || '';

		let output = `${colors.gray(timestamp)} ${level} ${msg}`;

		const meta = formatMeta(data);
		if (meta) output += ` ${meta}`;

		console.log(output);

		if (data.error) {
			const errObj = data.error;
			if (errObj.stack) {
				console.log(
					colors.red(
						errObj.stack
							.split('\n')
							.map(l => '  ' + l)
							.join('\n')
					)
				);
			} else {
				console.log(colors.red(`  Error: ${JSON.stringify(errObj)}`));
			}
		}
	} catch (e) {
		// RAW FALLBACK ---
		// Steps: preserve bytes/ordering by printing as-is when structure is unavailable.
		console.log(colors.gray(line));
	}
}

// MAIN ---
// Steps: validate type, pick latest file, read to end while keeping last N lines in a ring-ish buffer, print them, then poll for size growth and stream appended lines.
async function main() {
	const dir = DIRS[TYPE];
	if (!dir) {
		console.error(`Unknown log type: ${TYPE}. Use alert, error, or slow.`);
		process.exit(1);
	}

	const file = await findLatestLogFile(dir, FILENAMES[TYPE]);
	if (!file) {
		console.error(`No log files found in ${dir}`);
		process.exit(1);
	}

	console.log(colors.bold(`Reading ${TYPE} logs from ${path.basename(file)}...`));
	console.log(colors.bold('------------------------------------------------'));

	// INITIAL READ ---
	// Steps: stream line-by-line, keep only last N in memory, then render; this trades correctness-on-huge-files for dev simplicity.

	const stream = fs.createReadStream(file);
	const rl = readline.createInterface({
		input: stream,
		crlfDelay: Infinity,
	});

	// LAST-N BUFFER ---
	// Steps: push each line, shift when over limit, so memory stays bounded by `LINES`.
	const buffer = [];

	for await (const line of rl) {
		buffer.push(line);
		if (buffer.length > LINES) buffer.shift();
	}

	buffer.forEach(prettyPrint);

	// TAIL MODE ---
	// Steps: remember current file size, then poll; when file grows, stream the new bytes from the last offset and pretty-print as they arrive.
	let currentSize = fs.statSync(file).size;

	console.log(colors.bold('------------------------------------------------'));
	console.log(colors.bold(`Tailing... (Press Ctrl+C to stop)`));

	setInterval(() => {
		try {
			const stats = fs.statSync(file);
			if (stats.size > currentSize) {
				const stream = fs.createReadStream(file, { start: currentSize });
				const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

				stream.on('end', () => {
					// OFFSET ADVANCE ---
					// Steps: only move the cursor once the read stream finishes so we never skip bytes mid-read.
					currentSize = stats.size;
				});

				rl.on('line', prettyPrint);
			}
		} catch (e) {
			// ROTATION GAP ---
			// Steps: tolerate missing file so logrotate or manual deletion doesn’t crash the viewer.
		}
	}, 1000);
}

// ENTRYPOINT ---
// Steps: run async main; errors surface via Node’s default unhandled rejection behavior for CLI visibility.
main();
