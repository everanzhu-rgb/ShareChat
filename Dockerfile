FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S qijian && adduser -S qijian -G qijian
COPY --from=build --chown=qijian:qijian /app ./
USER qijian
EXPOSE 3000
CMD ["npm", "run", "start"]
