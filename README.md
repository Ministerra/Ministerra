# Ministerra

Monorepo containing the full-stack Ministerra application.

## Structure

-   `backend/` - Node.js/Express backend with TypeScript
-   `frontend/` - React frontend with Vite
-   `shared/` - Shared TypeScript types, constants, and utilities used by both backend and frontend

## Development

See individual README files in `backend/` and `frontend/` directories for specific setup instructions.

### Quick Start

```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Start development servers
npm run dev
```

## Deployment

See `deploy.sh` for production deployment scripts.
