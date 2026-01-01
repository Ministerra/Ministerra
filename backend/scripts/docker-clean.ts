#!/usr/bin/env node
/**
 * DOCKER CLEAN (COMPOSE PROJECT SCAVENGER)
 * Steps: parse args to discover compose file + project names, run `compose down`
 * (docker compose first, docker-compose fallback), then *also* force-remove any
 * left-behind containers/networks/volumes that still match the project labels.
 *
 * Rationale: Compose can crash or get interrupted mid-flight; the force-remove
 * stage is what actually prevents host-port conflicts and zombie resources.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// TYPES -----------------------------------------------------------------------
type ErrnoException = NodeJS.ErrnoException;

// TYPE GUARDS -----------------------------------------------------------------
// IS ERRNO EXCEPTION ---
// Steps: detect Node-ish spawn errors by presence of `.code`, so callers can branch on ENOENT safely.
function isErrnoException(error: unknown): error is ErrnoException {
	// ERRNO SHAPE ---
	// Steps: keep the guard minimal; only need `.code` to detect ENOENT.
	return Boolean(error) && typeof error === 'object' && 'code' in error;
}

// ARGUMENT PARSING -------------------------------------------------------------
const args = process.argv.slice(2);
let composeFileArg;
let pruneVolumes = false;
const projects = new Set<string>();

// POSITIONAL COLLECTION --------------------------------------------------------
// Steps: collect all non-flag tokens first so we can interpret “compose file then projects” deterministically.
const positional: string[] = [];
for (const arg of args) {
	// FLAG PASS ---
	// Steps: consume known flags early, otherwise treat as positional (compose path / project tokens).
	if (arg === '--prune-volumes') {
		pruneVolumes = true;
		continue;
	}
	if (arg.startsWith('--project=')) {
		addProjects(arg.substring('--project='.length));
		continue;
	}
	if (arg.startsWith('--add-project=')) {
		addProjects(arg.substring('--add-project='.length));
		continue;
	}
	positional.push(arg);
}

if (positional.length) {
	// POSITIONAL SHAPE ---
	// Steps: first positional is compose file path, remainder are extra projects to include.
	composeFileArg = positional.shift();
	positional.forEach(addProjects);
}

// DEFAULTS + DERIVED PROJECTS ---
// Steps: always include canonical `ministerra`, plus the compose file folder name, so both common naming schemes get cleaned.
const composeFile = path.resolve(composeFileArg || 'backend/docker-compose.yml');
addProjects('ministerra');
addProjects(path.basename(path.dirname(composeFile)));

const removedIds = new Set<string>();
const projectList = Array.from(projects).filter((value): value is string => Boolean(value));

for (const project of projectList) {
	// COMPOSE DOWN FIRST ---
	// Steps: prefer plugin (`docker compose`), fall back to legacy binary, then continue regardless of exit code.
	const composeArgs = ['-p', project, '-f', composeFile, 'down', '--remove-orphans'];
	const composeRan = runComposeDown('docker', ['compose', ...composeArgs]);
	if (!composeRan) {
		runComposeDown('docker-compose', composeArgs);
	}

	// After running compose down, forcibly remove any leftover resources that still
	// belong to the project. This handles cases where a previous Compose invocation
	// crashed mid-flight and left containers attached to the host ports.
	removeProjectResources(project);
}

// RUN COMPOSE DOWN -------------------------------------------------------------
// RUN COMPOSE DOWN ---
// Steps: spawn compose command, treat ENOENT as “binary missing”, treat non-zero exit as non-fatal so cleanup continues.
function runComposeDown(binary: string, argsList: string[]): boolean {
	// COMMAND EXEC ---
	// Steps: run with stdio passthrough so users see docker output; treat ENOENT as “binary not present”.
	const result = spawnSync(binary, argsList, { stdio: 'inherit' });
	if (result.error && isErrnoException(result.error) && result.error.code === 'ENOENT') {
		return false;
	}
	if (typeof result.status === 'number' && result.status !== 0) {
		console.alert(`Warning: '${binary} ${argsList.join(' ')}' exited with code ${result.status}. Continuing cleanup.`);
	}
	return true;
}

// RESOURCE CLEANUP -------------------------------------------------------------
// REMOVE PROJECT RESOURCES ---
// Steps: remove containers/networks/volumes that match the project; prefer label filters, fall back to name filters, optionally prune safe volumes.
function removeProjectResources(project: string): void {
	// CONTAINERS + NETWORKS ---
	// Steps: remove by compose label first (most precise), then name prefix (covers drift/older versions), then networks.
	removeResources(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], ['rm', '-f']);
	removeResources(['ps', '-aq', '--filter', `name=${project}-`], ['rm', '-f']);
	removeResources(['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], ['network', 'rm']);

	if (pruneVolumes) {
		// VOLUME PRUNE (OPT-IN) ---
		// Steps: list project-labeled volumes, subtract mysql-ish volumes (data safety), then rm remaining once each.
		const volumeIds = listResources(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]);
		const mysqlVolumes = new Set(listResources(['volume', 'ls', '-q', '--filter', 'name=mysql']));
		const safeVolumeIds = volumeIds.filter(id => !mysqlVolumes.has(id));
		if (safeVolumeIds.length) {
			const ids = safeVolumeIds.filter(id => !removedIds.has(id));
			if (ids.length) {
				spawnSync('docker', ['volume', 'rm', ...dedupe(ids)], { stdio: 'inherit' });
				ids.forEach(id => removedIds.add(id));
			}
		}
	}
}

// GENERIC REMOVE ---------------------------------------------------------------
// REMOVE RESOURCES ---
// Steps: list current IDs, skip ones we already removed, then execute one docker remove command with deduped IDs.
function removeResources(listArgs: string[], removeArgs: string[]): void {
	// ID GATHER + DEDUPE ---
	// Steps: list current IDs, filter out already-removed ones (cross-project overlap), then execute one docker rm/rm-like call.
	const ids = listResources(listArgs).filter(id => !removedIds.has(id));
	if (!ids.length) {
		return;
	}

	spawnSync('docker', [...removeArgs, ...dedupe(ids)], { stdio: 'inherit' });
	ids.forEach(id => removedIds.add(id));
}

// RESOURCE LISTING -------------------------------------------------------------
// LIST RESOURCES ---
// Steps: run docker listing command, parse stdout into trimmed IDs, return empty on missing docker or errors (best-effort cleanup).
function listResources(listArgs: string[]): string[] {
	// DOCKER QUERY ---
	// Steps: run docker with stdout capture; if docker is missing or errors, treat as empty (cleanup is best-effort).
	const result = spawnSync('docker', listArgs, { encoding: 'utf8' });
	if (result.error && isErrnoException(result.error) && result.error.code === 'ENOENT') {
		return [];
	}
	if (result.status && result.status !== 0) {
		return [];
	}

	return result.stdout
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
}

// DEDUPLICATION ----------------------------------------------------------------
// DEDUPE VALUES ---
// Steps: collapse duplicates so docker command args stay minimal and deterministic.
function dedupe(values: string[]): string[] {
	// SET COLLAPSE ---
	// Steps: preserve semantics (order is irrelevant here) while preventing repeated docker args.
	return Array.from(new Set(values));
}

// PROJECT NAME PARSING ---------------------------------------------------------
// ADD PROJECTS ---
// Steps: accept comma-separated tokens, recall this is called from both flags and positional args, and store into a Set for unique cleanup targets.
function addProjects(value: string): void {
	if (!value) return;
	// TOKENIZE ---
	// Steps: allow comma-separated project names so callers can pass `--project=a,b` or positional `a,b`.
	value
		.split(',')
		.map(token => token.trim())
		.filter(Boolean)
		.forEach(name => projects.add(name));
}
