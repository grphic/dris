# DRIS in één container: de app bouwen met Node, daarna serveren met Caddy.
# Caddy voegt de NS API-key toe aan de API-aanvragen; de key komt uit de omgeving (.env), niet uit de image.
# Bouwen vanuit de projectmap:  docker compose -f docker/compose.yaml up -d --build

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/dris
EXPOSE 80
