FROM node:20

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