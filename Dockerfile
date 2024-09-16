FROM node:20

WORKDIR /app

COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

COPY . .

# Remove any potential .env files that may have been copied
RUN rm -f .env

CMD ["npm", "start"]