import fs from 'fs';
import path from 'path';

// EXTRACT CSS CLASSES ----------------------------------------------------------
// Steps: scan CSS text for `.className` selectors, collect into a Set, then return sorted array so output is deterministic for diffs.
function extractCSSClasses(cssContent) {
	const classes = new Set();

	// Match class selectors (e.g., .className)
	const classRegex = /\.([a-zA-Z0-9_-]+)[\s\{,:>~+\[\.]/g;
	let match;

	while ((match = classRegex.exec(cssContent)) !== null) {
		classes.add(match[1]);
	}

	return Array.from(classes).sort();
}

// EXTRACT USED CLASSES ---------------------------------------------------------
// Steps: recursively scan JS/JSX files, parse className/class string literals and simple template literal patterns, then return a sorted unique list for comparison.
function extractUsedClasses(directory) {
	const classes = new Set();

	// DIRECTORY WALK -----------------------------------------------------------
	// Steps: depth-first traverse so we don’t miss nested components; only reads .js/.jsx by design for this script.
	function scanDirectory(dir) {
		const files = fs.readdirSync(dir, { withFileTypes: true });

		for (const file of files) {
			const fullPath = path.join(dir, file.name);

			if (file.isDirectory()) {
				scanDirectory(fullPath);
			} else if (file.name.endsWith('.jsx') || file.name.endsWith('.js')) {
				const content = fs.readFileSync(fullPath, 'utf-8');

				// Handle template literals: className={`...`} and class={`...`}
				const templateLiteralRegex = /(className|class)\s*=\s*\{`[\s\S]*?`\}/g;
				const templateMatches = content.match(templateLiteralRegex) || [];

				for (const match of templateMatches) {
					// Extract all strings within single quotes in the template literal
					const stringRegex = /'([^']*)'/g;
					let stringMatch;

					while ((stringMatch = stringRegex.exec(match)) !== null) {
						const classString = stringMatch[1];
						// Split by spaces and extract valid class names
						const classNames = classString.split(/\s+/).filter(cls => cls && cls.length > 0 && cls.length < 50 && /^[a-zA-Z0-9_-]+$/.test(cls));
						classNames.forEach(cls => classes.add(cls));
					}

					// Also extract classes outside of quotes in the template literal
					// Remove all quoted strings first, then extract remaining classes
					let remaining = match.replace(/'[^']*'/g, ' ');
					const remainingClasses = remaining.split(/\s+/).filter(cls => cls && cls.length > 0 && cls.length < 50 && /^[a-zA-Z0-9_-]+$/.test(cls));
					remainingClasses.forEach(cls => classes.add(cls));
				}

				// Handle regular string attributes: className="..." or class="..."
				// Also handle className='...' or class='...'
				const stringRegex = /(className|class)\s*=\s*["']([^"']+)["']/g;
				let stringMatch;

				while ((stringMatch = stringRegex.exec(content)) !== null) {
					const classString = stringMatch[2]; // Note: index 2 because we have two capture groups now
					const classNames = classString.split(/\s+/).filter(cls => cls && cls.length > 0 && cls.length < 50 && /^[a-zA-Z0-9_-]+$/.test(cls));
					classNames.forEach(cls => classes.add(cls));
				}
			}
		}
	}

	scanDirectory(directory);
	return Array.from(classes).sort();
}

// MAIN EXECUTION ---------------------------------------------------------------
// Steps: load CSS, extract defined classes, extract used classes, diff to unused, then write three result files for follow-up cleanup scripts.
console.log('Analyzing CSS file...');
const cssPath = 'frontend/src/css/VisualClasses.css';
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const cssClasses = extractCSSClasses(cssContent);

console.log('Scanning frontend code for used classes...');
const usedClasses = extractUsedClasses('frontend/src');

console.log('\n=== ANALYSIS RESULTS ===');
console.log(`Total classes defined in CSS: ${cssClasses.length}`);
console.log(`Total classes used in code: ${usedClasses.length}`);

// Find unused classes
const usedClassesSet = new Set(usedClasses);
const unusedClasses = cssClasses.filter(cls => !usedClassesSet.has(cls));

console.log(`\nUnused classes: ${unusedClasses.length}`);

// Write results to files
fs.writeFileSync('css_classes.txt', cssClasses.join('\n'));
fs.writeFileSync('used_classes.txt', usedClasses.join('\n'));
fs.writeFileSync('unused_classes.txt', unusedClasses.join('\n'));

console.log('\nResults written to:');
console.log('  - css_classes.txt (all CSS classes)');
console.log('  - used_classes.txt (classes used in code)');
console.log('  - unused_classes.txt (unused classes)');

console.log('\nFirst 20 unused classes:');
unusedClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
