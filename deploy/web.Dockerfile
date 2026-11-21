# The web view: built with Vite, served by nginx, which also forwards /api.
FROM node:24.21.0-alpine AS build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web ./
RUN npm run build

FROM nginx:1.27-alpine
# Defaults for compose; Railway sets PORT, and API_UPSTREAM in the service.
ENV PORT=80 API_UPSTREAM=api:3000
# The image turns templates/*.template into conf.d/*.conf with envsubst; only
# these two names are replaced, so nginx's own $host and $uri stay.
ENV NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM)$"
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
