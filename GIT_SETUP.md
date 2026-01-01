# Git Repository Setup Instructions

## Current Status
✅ Root Git repo initialized
✅ All files committed (backend, frontend, shared)
✅ Nested .git folders removed

## Next Steps

### 1. Create GitHub Repository
- Go to: https://github.com/organizations/Placentra/repositories/new
- Name: `Ministerra`
- Description: "Full-stack Ministerra application monorepo"
- **DO NOT** initialize with README/license (we already have them)
- Click "Create repository"

### 2. Connect Local Repo to GitHub

```bash
# Add the remote (replace with your actual repo URL)
git remote add origin git@github.com:Placentra/Ministerra.git

# Or if using HTTPS:
# git remote add origin https://github.com/Placentra/Ministerra.git

# Push everything
git branch -M main
git push -u origin main
```

### 3. Future Pushes

From now on, push everything from the root folder:

```bash
cd /path/to/Ministerra
git add .
git commit -m "Your commit message"
git push
```

## Important Notes

- **All code is now in ONE repository** - backend, frontend, and shared
- **Push from root folder only** - no need to push from backend/ or frontend/ anymore
- The old BackEnd and FrontEnd repos can be archived or kept for reference

