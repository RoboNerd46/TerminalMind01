# Use a specific Node.js version for consistency and smaller image size (Alpine)
FROM node:20-alpine 

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
# If these files don't change, npm install step will be cached
# Note: With 'npm install' below, package-lock.json will be generated/updated
# if it's not committed, but copying it first can still help with caching
# if it *is* committed or if you decide to commit it later.
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
