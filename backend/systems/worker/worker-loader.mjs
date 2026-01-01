// WORKER LOADER WRAPPER --------------------------------------------------------
// Uses tsx programmatically to load worker.ts, avoiding loader registration issues
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register tsx loader programmatically using register API
try {
	const tsxLoaderPath = path.resolve(__dirname, '../../node_modules/tsx/dist/loader.mjs');
	const tsxLoaderUrl = pathToFileURL(tsxLoaderPath).href;
	register(tsxLoaderUrl, import.meta.url);
} catch (err) {
	// Fallback: try importing tsx/esm directly
	await import('tsx/esm');
}

// Now import the actual worker - tsx loader will handle .ts resolution
await import('./worker.ts');

