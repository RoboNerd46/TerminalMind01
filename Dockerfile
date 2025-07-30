# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory first
# This is an optimization for Docker caching.
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of your application code to the working directory
# This includes server.js, and your 'public' folder.
COPY . .

# Expose the port your app runs on. This should match the PORT your server listens on (10000).
EXPOSE 10000

# Command to run the application when the container starts
CMD [ "node", "server.js" ]
