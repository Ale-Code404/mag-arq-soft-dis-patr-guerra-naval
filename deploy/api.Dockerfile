# The API: TypeScript run by tsx, as in development (the project emits no JS).
FROM node:24.21.0-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# tsx and typescript are devDependencies, and they run the API.
RUN npm ci --include=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

USER node
EXPOSE 3000
# Migrations run on start (src/main.ts), before the API listens.
CMD ["npx", "tsx", "src/main.ts"]
