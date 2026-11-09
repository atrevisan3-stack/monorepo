FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY apps/dashboard/ ./
EXPOSE 3000
USER node
CMD ["node", "server.js"]
