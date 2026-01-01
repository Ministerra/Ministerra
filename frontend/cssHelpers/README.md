# CSS Helper Scripts

This folder contains utility scripts for analyzing and cleaning CSS files by removing unused classes.

## Scripts

### 1. analyze_classes.js

Analyzes the CSS file and scans the frontend codebase to identify which CSS classes are actually being used.

**What it searches for:**

-   `className={...}` (React components)
-   `class={...}` (Custom HTML elements)
-   Both string values and template literals with conditional expressions

**Usage:**

```bash
node cssHelpers/analyze_classes.js
```

**Output:**

-   `css_classes.txt` - All classes defined in VisualClasses.css
-   `used_classes.txt` - Classes actually used in the frontend code
-   `unused_classes.txt` - Classes that are not being used

### 2. clean_css.js

Removes unused CSS classes from the VisualClasses.css file based on the analysis from step 1.

**Usage:**

```bash
node cssHelpers/clean_css.js
```

**Requirements:**

-   Must run `analyze_classes.js` first to generate `unused_classes.txt`

**Output:**

-   `frontend/src/css/VisualClasses_cleaned.css` - Cleaned CSS file

### 3. post_process_css.js

Post-processes the cleaned CSS file to:

-   Remove excessive blank lines
-   Remove orphaned comment lines

**Usage:**

```bash
node cssHelpers/post_process_css.js
```

**Requirements:**

-   Must run `clean_css.js` first

## Complete Workflow

To clean up your CSS file:

```bash
# Step 1: Analyze classes
node cssHelpers/analyze_classes.js

# Step 2: Clean the CSS
node cssHelpers/clean_css.js

# Step 3: Post-process
node cssHelpers/post_process_css.js

# Step 4: Backup and replace
cp frontend/src/css/VisualClasses.css frontend/src/css/VisualClasses_backup.css
cp frontend/src/css/VisualClasses_cleaned.css frontend/src/css/VisualClasses.css

# Step 5: Cleanup temporary files (optional)
rm css_classes.txt used_classes.txt unused_classes.txt
rm frontend/src/css/VisualClasses_cleaned.css
```

## Notes

-   Always backup your original CSS file before replacing it
-   Review the `unused_classes.txt` file before cleaning to ensure no important classes are being removed
-   The scripts preserve:
    -   Global rules (\*, button, h1-h6, etc.)
    -   @keyframes and @media queries
    -   Pseudo-selectors and element selectors
-   The scripts handle multi-line className attributes in JSX files
