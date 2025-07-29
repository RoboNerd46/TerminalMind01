# Use a base image with Node.js and apt-get (Debian-based)
FROM node:18-slim

# Install ffmpeg
# - update apt package list
# - install ffmpeg with no recommended packages to keep image small
# - clean up apt cache to further reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
# This step is done separately to leverage Docker's layer caching
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your Node.js application listens on
EXPOSE 3000

# Command to run your application
CMD ["npm", "start"]
