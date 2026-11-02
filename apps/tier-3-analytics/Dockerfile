FROM node:22-alpine
ENV NODE_ENV=production PORT=3003
WORKDIR /app
COPY apps/tier-3-analytics/ ./
EXPOSE 3003
USER node
CMD ["node", "server.js"]
