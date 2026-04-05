FROM node:18-alpine

WORKDIR /app

# Install dependencies (using npm install instead of npm ci for flexibility)
COPY package.json ./
RUN npm install

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Run application
CMD ["npm", "start"]
