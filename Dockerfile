# Reportería RRSS · imagen para Railway (Node 24 con SQLite integrado; única dependencia: el SDK de Claude)
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 5003
CMD ["node", "server.js"]
