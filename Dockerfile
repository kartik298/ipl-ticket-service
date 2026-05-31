FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache fontconfig
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
RUN mkdir -p /app/tickets
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3006/health || exit 1
CMD ["node", "src/index.js"]
