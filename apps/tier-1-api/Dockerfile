FROM node:22-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY apps/tier-1-api/ ./
EXPOSE 3001
USER node
CMD ["node", "server.js"]
