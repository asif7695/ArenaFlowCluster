# ArenaFlowCluster dashboard — Next.js 14 (App Router).
# Multi-stage: build once, run the compiled output.
#   docker build -t arenaflow-dashboard:latest dashboard/
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* are inlined at build time; the browser calls the API directly,
# so this must be a HOST-reachable URL (overridden by compose to localhost:5000).
ARG NEXT_PUBLIC_API_BASE=http://localhost:5000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

FROM node:18-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.js ./next.config.js
EXPOSE 3000
CMD ["npm", "start"]
