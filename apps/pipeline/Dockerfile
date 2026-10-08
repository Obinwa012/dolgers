# Cloud Run Job image for the sourcing pipeline. Build from the repository root:
#   docker build -f apps/pipeline/Dockerfile -t pipeline .
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/pipeline/package.json apps/pipeline/
RUN npm ci --omit=dev --workspaces --include-workspace-root=false --ignore-scripts
COPY packages/core packages/core
COPY apps/pipeline apps/pipeline
WORKDIR /app/apps/pipeline
ENTRYPOINT ["npx", "tsx", "src/cli.ts"]
CMD ["run", "--limit", "25"]
