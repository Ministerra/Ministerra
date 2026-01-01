import fs from 'fs';

// INPUT LOAD -------------------------------------------------------------------
// Steps: read the cleaned CSS file produced by clean_css.ts, then split into lines for simple post-processing passes.
const cssContent = fs.readFileSync('frontend/src/css/VisualClasses_cleaned.css', 'utf-8');
const lines = cssContent.split('\n');
const newLines = [];

// REMOVE EXCESS BLANK LINES ----------------------------------------------------
// Steps: collapse long blank stretches down to at most two blank lines so the file stays readable without changing semantics.
let consecutiveBlankCount = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed === '') {
        consecutiveBlankCount++;
        if (consecutiveBlankCount <= 2) {
            newLines.push(line);
        }
    } else {
        consecutiveBlankCount = 0;
        newLines.push(line);
    }
}

// REMOVE ORPHAN COMMENTS -------------------------------------------------------
// Steps: drop single-line comments that are not followed by a rule (after blank lines), so leftovers from removed blocks don’t create noisy separators.
const finalLines = [];
for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i].trim();
    
    // Check if it's a comment line
    if (line.startsWith('/*') && !line.includes('*/')) {
        // Multi-line comment start
        finalLines.push(newLines[i]);
    } else if (line.startsWith('/*') && line.includes('*/')) {
        // Single-line comment - check if next non-empty line is a CSS rule
        let j = i + 1;
        let foundContent = false;
        while (j < newLines.length && newLines[j].trim() === '') {
            j++;
        }
        if (j < newLines.length && newLines[j].trim() !== '' && !newLines[j].trim().startsWith('/*')) {
            foundContent = true;
        }
        if (foundContent) {
            finalLines.push(newLines[i]);
        }
    } else {
        finalLines.push(newLines[i]);
    }
}

const cleanedCSS = finalLines.join('\n');
fs.writeFileSync('frontend/src/css/VisualClasses_cleaned.css', cleanedCSS);

console.log('Post-processing complete!');
console.log(`Lines before: ${newLines.length}`);
console.log(`Lines after: ${finalLines.length}`);


