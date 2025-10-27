# syntax=docker/dockerfile:1

# Base deps layer (cacheable)
FROM node:20-bookworm-slim AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Development stage 
FROM node:20-bookworm-slim AS dev
WORKDIR /usr/src/app
ENV NODE_ENV=development
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
EXPOSE 5000

CMD ["npm","run","dev"]

# Production build stage 
FROM node:20-bookworm-slim AS prod-build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production

# Minimal production runtime: distroless Node
FROM gcr.io/distroless/nodejs20-debian12 AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=prod-build /usr/src/app /usr/src/app
EXPOSE 5000
USER nonroot
# Distroless Node runs scripts via the built-in node entrypoint
CMD ["index.js"]
