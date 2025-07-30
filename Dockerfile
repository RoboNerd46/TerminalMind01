# Use an official Node.js runtime as the base image
FROM node:18-alpine # You can choose a specific Node.js version, e.g., node:20-alpine or node:lts-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory first
# This is an optimization: if your dependencies don't change, Docker can use
# a cached layer for npm install, speeding up subsequent builds.
COPY package*.json ./

# Install Node.js dependencies
# This command will read package.json and install 'express', 'ws', 'axios', 'dotenv'
RUN npm install

# Copy the rest of your application code to the working directory
# This includes server.js, and your 'public' folder (containing index.html, etc.)
COPY . .

# Expose the port your app runs on. This should match the PORT your server listens on.
# Your server.js defaults to 10000.
EXPOSE 10000

# Command to run the application when the container starts
CMD [ "node", "server.js" ]
