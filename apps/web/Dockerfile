# syntax=docker/dockerfile:1.7
# Produção: build do Vite e servir com nginx. Contexto de build = raiz do repositório.
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web...
COPY apps/web apps/web
COPY openapi.json ./
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter web build

FROM nginx:1.31-alpine
# O nginx não conhece .mjs (serviria application/octet-stream) e um worker de módulo com nosniff exige JavaScript.
RUN sed -i 's|^\(\s*application/javascript\s*js\);|\1 mjs;|' /etc/nginx/mime.types && grep -q 'js mjs;' /etc/nginx/mime.types
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/health || exit 1
