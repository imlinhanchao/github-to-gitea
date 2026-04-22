FROM node:20

# Install git for repository clone/fetch operations at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the pre-built dist directory
COPY dist/ ./dist/

# Install production dependencies in dist
WORKDIR /app/dist
RUN npm ci --omit=dev

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "main.js"]