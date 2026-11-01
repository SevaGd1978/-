FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev && npm cache clean --force

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
ENV PUTEVOY_DB=/data/putevoy.sqlite

RUN mkdir -p /data
VOLUME /data

EXPOSE 3000
CMD ["npm", "run", "start"]
