# Use a specific Node.js version for consistency and smaller image size (Alpine)
FROM node:20-alpine 

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install FFmpeg and its dependencies, including fonts for drawtext
# font-dejavu is a common choice for monospace fonts on Alpine
RUN apk add --no-cache ffmpeg build-base linux-headers \
    font-dejavu \
    # You might consider 'font-terminus' or 'font-noto-cjk' if DejaVu isn't your preference
    && rm -rf /var/cache/apk/*

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies using 'npm install'.
# This command will generate package-lock.json if it doesn't exist,
# or update it based on package.json.
# '--omit=dev' ensures only production dependencies are installed, making the image smaller.
RUN npm install --omit=dev 

# Copy the rest of your application code
# This includes server.js and the entire 'public' directory
COPY . .

# Expose the port your Express app listens on. Render uses PORT env var.
EXPOSE 10000

# Command to run your application when the container starts
CMD ["node", "server.js"]
