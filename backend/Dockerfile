# Use high-performance slim LTS Node version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency packages definitions
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set running environmental parameters
ENV NODE_ENV=production
ENV PORT=5000

# Expose backend service port
EXPOSE 5000

# Boot backend web server
CMD ["node", "src/server.js"]
