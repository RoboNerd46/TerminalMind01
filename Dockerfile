# Use a specific Node.js version for consistency. E.g., node:18-alpine, node:20-slim
FROM node:20-alpine 

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
# If these files don't change, npm install step will be cached
COPY package*.json ./

# Install dependencies. Using 'npm ci' is often preferred in CI/CD environments
# because it installs dependencies exactly as specified in package-lock.json
# and is generally faster for clean installs.
RUN npm ci --omit=dev 

# Copy the rest of your application code
# This should include your 'public' folder and 'server.js'
COPY . .

# Expose the port your Express app listens on (default is 10000 on Render)
EXPOSE 10000

# Command to run your application
# Using 'node server.js' directly is often better than 'npm start' in Docker
# for proper signal handling.
CMD ["node", "server.js"]
