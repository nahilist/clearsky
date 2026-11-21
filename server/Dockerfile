# Build context is the repo root (the server imports ../app/src/shared):
#   docker build -f server/Dockerfile -t clearsky-api .
FROM node:22-slim AS build
WORKDIR /repo
COPY app/src/shared app/src/shared
COPY server/package*.json server/
RUN cd server && npm ci
COPY server server
RUN cd server && npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /srv
COPY --from=build /repo/server/node_modules node_modules
COPY --from=build /repo/server/dist dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.mjs"]
