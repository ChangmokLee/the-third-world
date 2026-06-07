# Minimal production image. Works on Fly.io, Railway, Render (Docker), etc.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
# Platforms inject PORT; default to 3000 locally.
EXPOSE 3000

CMD ["npm", "start"]
