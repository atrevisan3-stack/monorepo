FROM node:22-alpine
ENV NODE_ENV=production PORT=3002
WORKDIR /app
COPY apps/tier-2-notifications/ ./
EXPOSE 3002
USER node
CMD ["node", "server.js"]
