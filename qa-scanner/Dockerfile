# Container packaging for cloud hosts (Render, Railway, Fly.io, any Docker
# host). The base image version MUST match the playwright version pinned in
# package.json — it ships the matching Chromium and all its system libraries.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Persist scan results on the mounted disk (see render.yaml).
ENV DATA_DIR=/data

EXPOSE 3000
CMD ["node", "server/index.js"]
