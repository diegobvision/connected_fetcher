# Dockerfile

# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose a port if needed (optional, if your app listens on a port)
# EXPOSE 3000

# Run the application
CMD ["node", "index.js"]
