FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/sabaq.db
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
