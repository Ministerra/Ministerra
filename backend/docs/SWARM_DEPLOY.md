# Ministerra Swarm Deployment Guide

This guide details how to deploy Ministerra using Docker Swarm. This architecture replaces the legacy custom `cluster` logic with industry-standard container orchestration.

## Prerequisites

-   Docker Engine (installed)
-   Git (for checking out the repo)
-   A server (or local machine) to act as the Swarm Manager.

## 1. Initialize Swarm

If you haven't already initialized Swarm on this node:

```bash
docker swarm init
# If you have multiple IPs, specify the advertise address:
# docker swarm init --advertise-addr <YOUR_SERVER_IP>
```

## 2. Prepare Environment

Ensure your `.env` file is present in the root `backend/` directory. The stack deploy command uses this file to populate environment variables.

## 3. Build Images

Since we are deploying a stack, we need the images to be available. Build them locally tagged as `latest`.

```bash
# Build Backend
docker build -t ministerra-backend:latest -f backend/Dockerfile .

# Build Frontend
docker build -t ministerra-frontend:latest -f frontend/Dockerfile .
```

_Note: In a multi-node production setup, you would push these images to a registry (e.g., Docker Hub or GHCR) so other nodes can pull them._

## 4. Deploy the Stack

Deploy the services defined in `backend/docker-compose.stack.yml`. We call the stack `ministerra`.

```bash
# Navigate to the root folder where the compose file is visible relative to build context
docker stack deploy -c backend/docker-compose.stack.yml ministerra
```

## 5. Verify Deployment

Check the status of your services:

```bash
docker service ls
```

You should see:

-   `ministerra_backend-web`: 2/2 replicas (Handling traffic)
-   `ministerra_backend-tasks`: 1/1 replicas (Handling cron jobs)
-   `ministerra_traefik`: Global (Load Balancer)
-   Plus Redis, MySQL, and Monitoring services.

## 6. Managing the Swarm

### Scaling Up

To handle more traffic, simply scale the web service. Zero downtime, immediate effect.

```bash
docker service scale ministerra_backend-web=5
```

### Viewing Logs

To see logs from all replicas of the web service aggregated together:

```bash
docker service logs -f ministerra_backend-web
```

### Updating the App

1. Make code changes.
2. Rebuild the image: `docker build -t ministerra-backend:latest -f backend/Dockerfile .`
3. Update the service (force update to pull/use new image):
    ```bash
    docker service update --force --image ministerra-backend:latest ministerra_backend-web
    ```
    _Traefik will route traffic to the new containers only when they are ready._

## Troubleshooting

-   **Sticky Sessions:** If Socket.IO keeps disconnecting, check Traefik logs:
    `docker service logs ministerra_traefik`
-   **Database Connection:** Ensure `mysql-data` volume is correctly mapped if you are migrating existing data.

This guide details how to deploy Ministerra using Docker Swarm. This architecture replaces the legacy custom `cluster` logic with industry-standard container orchestration.

## Prerequisites

-   Docker Engine (installed)
-   Git (for checking out the repo)
-   A server (or local machine) to act as the Swarm Manager.

## 1. Initialize Swarm

If you haven't already initialized Swarm on this node:

```bash
docker swarm init
# If you have multiple IPs, specify the advertise address:
# docker swarm init --advertise-addr <YOUR_SERVER_IP>
```

## 2. Prepare Environment

Ensure your `.env` file is present in the root `backend/` directory. The stack deploy command uses this file to populate environment variables.

## 3. Build Images

Since we are deploying a stack, we need the images to be available. Build them locally tagged as `latest`.

```bash
# Build Backend
docker build -t ministerra-backend:latest -f backend/Dockerfile .

# Build Frontend
docker build -t ministerra-frontend:latest -f frontend/Dockerfile .
```

_Note: In a multi-node production setup, you would push these images to a registry (e.g., Docker Hub or GHCR) so other nodes can pull them._

## 4. Deploy the Stack

Deploy the services defined in `backend/docker-compose.stack.yml`. We call the stack `ministerra`.

```bash
# Navigate to the root folder where the compose file is visible relative to build context
docker stack deploy -c backend/docker-compose.stack.yml ministerra
```

## 5. Verify Deployment

Check the status of your services:

```bash
docker service ls
```

You should see:

-   `ministerra_backend-web`: 2/2 replicas (Handling traffic)
-   `ministerra_backend-tasks`: 1/1 replicas (Handling cron jobs)
-   `ministerra_traefik`: Global (Load Balancer)
-   Plus Redis, MySQL, and Monitoring services.

## 6. Managing the Swarm

### Scaling Up

To handle more traffic, simply scale the web service. Zero downtime, immediate effect.

```bash
docker service scale ministerra_backend-web=5
```

### Viewing Logs

To see logs from all replicas of the web service aggregated together:

```bash
docker service logs -f ministerra_backend-web
```

### Updating the App

1. Make code changes.
2. Rebuild the image: `docker build -t ministerra-backend:latest -f backend/Dockerfile .`
3. Update the service (force update to pull/use new image):
    ```bash
    docker service update --force --image ministerra-backend:latest ministerra_backend-web
    ```
    _Traefik will route traffic to the new containers only when they are ready._

## Troubleshooting

-   **Sticky Sessions:** If Socket.IO keeps disconnecting, check Traefik logs:
    `docker service logs ministerra_traefik`
-   **Database Connection:** Ensure `mysql-data` volume is correctly mapped if you are migrating existing data.
