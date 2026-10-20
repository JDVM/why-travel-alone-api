# The API as a container image. Runs anywhere that runs containers.
#
#   docker build -t why-travel-alone-api .
#   docker run --env-file .env.production -p 8080:8080 why-travel-alone-api
#
# Database migrations run as a separate step before each release, with the
# same image:
#   docker run --rm --env-file .env.production why-travel-alone-api npm run migrate
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

# Run as the unprivileged user the Node image provides, not root.
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# node directly (not npm start) so SIGTERM reaches server.js for a graceful shutdown.
CMD ["node", "server.js"]
