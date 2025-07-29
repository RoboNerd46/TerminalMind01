# Use a Node.js 18 image with Debian Bullseye slim, which is a good base
# for smaller images and often compatible with systems that require FFmpeg.
FROM node:18-bullseye-slim

# Install FFmpeg and other necessary packages
# ffmpeg is essential for video streaming.
# libx264-dev provides development files for H.264 encoding with x264.
# procps contains utilities like ps, which might be useful for monitoring processes.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libx264-dev \
    procps \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
# This allows caching of dependencies
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD [ "node", "server.js" ]
