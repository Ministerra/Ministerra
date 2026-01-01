import fs from 'fs';

// INPUT LOAD -------------------------------------------------------------------
// Steps: read source CSS and the unused class list produced by analyze script, then precompute a Set for O(1) membership checks.
const cssContent = fs.readFileSync('frontend/src/css/VisualClasses.css', 'utf-8');
const unusedClassesStr = fs.readFileSync('unused_classes.txt', 'utf-8');
const unusedClasses = new Set(unusedClassesStr.trim().split('\n'));

console.log(`Loaded ${unusedClasses.size} unused classes`);

// PARSE CSS INTO BLOCKS --------------------------------------------------------
// Steps: scan text while tracking brace depth and comment state, then slice selector+content blocks so we can decide keep/drop without a full CSS parser.
function parseCSS(css) {
    const blocks = [];
    let currentPos = 0;
    let braceDepth = 0;
    let blockStart = 0;
    let inComment = false;
    
    for (let i = 0; i < css.length; i++) {
        if (css[i] === '/' && css[i + 1] === '*') {
            inComment = true;
            i++;
            continue;
        }
        if (inComment && css[i] === '*' && css[i + 1] === '/') {
            inComment = false;
            i++;
            continue;
        }
        
        if (!inComment) {
            if (css[i] === '{') {
                if (braceDepth === 0) {
                    blockStart = i;
                }
                braceDepth++;
            } else if (css[i] === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    // Found a complete block
                    const selectorStart = css.lastIndexOf('\n', blockStart);
                    let selector = css.substring(selectorStart, blockStart).trim();
                    // Look further back if selector is empty or incomplete
                    let tempStart = selectorStart;
                    while (selector === '' || selector.startsWith('{')) {
                        tempStart = css.lastIndexOf('\n', tempStart - 1);
                        if (tempStart === -1) break;
                        selector = css.substring(tempStart, blockStart).trim();
                    }
                    const content = css.substring(blockStart, i + 1);
                    blocks.push({ selector, content, fullText: selector + content });
                }
            }
        }
    }
    
    return blocks;
}

// EXTRACT CLASS NAMES FROM SELECTOR -------------------------------------------
// Steps: pull `.class` tokens from selector text so multi-class selectors are handled conservatively (keep if any class is used).
function extractClassNamesFromSelector(selector) {
    const classes = [];
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;
    let match;
    
    while ((match = classRegex.exec(selector)) !== null) {
        classes.push(match[1]);
    }
    
    return classes;
}

// SHOULD KEEP BLOCK? -----------------------------------------------------------
// Steps: always keep non-class/global rules and @-rules, otherwise keep when any referenced class is not in the unused list (conservative to avoid deleting shared rules).
function shouldKeepBlock(selector) {
    // Always keep global rules (not starting with a class selector)
    if (!selector.includes('.')) {
        return true; // Keep rules like *, button, h1, etc.
    }
    
    // Keep @-rules like @keyframes, @media
    if (selector.startsWith('@')) {
        return true;
    }
    
    // Extract class names from the selector
    const classNames = extractClassNamesFromSelector(selector);
    
    // If no classes found, keep it
    if (classNames.length === 0) {
        return true;
    }
    
    // If any class in the selector is used, keep the rule
    for (const className of classNames) {
        if (!unusedClasses.has(className)) {
            return true; // At least one class is used
        }
    }
    
    // All classes are unused, remove this rule
    return false;
}

// LINE-BASED FILTER ------------------------------------------------------------
// Steps: walk file line-by-line, detect selector starts, then skip entire blocks whose selector resolves to unused-only classes; preserves comments/formatting outside removed blocks.
const lines = cssContent.split('\n');
const newLines = [];
let inMultiLineComment = false;
let currentBlock = '';
let currentSelector = '';
let braceCount = 0;
let skipBlock = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Handle multi-line comments
    if (trimmed.includes('/*')) inMultiLineComment = true;
    if (inMultiLineComment) {
        newLines.push(line);
        if (trimmed.includes('*/')) inMultiLineComment = false;
        continue;
    }
    
    // If we're in a block that should be skipped
    if (skipBlock) {
        if (trimmed.includes('{')) braceCount++;
        if (trimmed.includes('}')) {
            braceCount--;
            if (braceCount === 0) {
                skipBlock = false;
                currentSelector = '';
            }
        }
        continue;
    }
    
    // Track braces to know when we're in/out of blocks
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    
    // If we're starting a new block
    if (braceCount === 0 && openBraces > 0) {
        // This line has a selector
        currentSelector = line.substring(0, line.indexOf('{')).trim();
        
        // Check if we should keep this block
        if (!shouldKeepBlock(currentSelector)) {
            skipBlock = true;
            braceCount = openBraces - closeBraces;
            if (braceCount === 0) {
                skipBlock = false;
                currentSelector = '';
            }
            continue;
        }
    }
    
    braceCount += openBraces - closeBraces;
    newLines.push(line);
}

const cleanedCSS = newLines.join('\n');

// Write the cleaned CSS
fs.writeFileSync('frontend/src/css/VisualClasses_cleaned.css', cleanedCSS);

console.log('\n=== CLEANING COMPLETE ===');
console.log(`Original file: ${lines.length} lines`);
console.log(`Cleaned file: ${newLines.length} lines`);
console.log(`Removed: ${lines.length - newLines.length} lines`);
console.log('\nCleaned CSS written to: frontend/src/css/VisualClasses_cleaned.css');


