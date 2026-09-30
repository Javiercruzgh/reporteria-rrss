# Herramienta de Monkey System · imagen para Railway (Node 24 con SQLite integrado, sin paquetes externos)
# Si la herramienta suma dependencias: agregar `COPY package*.json ./` y `RUN npm ci --omit=dev` antes de `COPY . .`.
FROM node:24-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 5001
CMD ["node", "server.js"]
