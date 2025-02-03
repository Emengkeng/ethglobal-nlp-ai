FROM node:22-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Start the agent container
CMD ["node", "dist/main.js"]