FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build (compile TypeScript if needed)
RUN npm run compile || true

# Start the server
CMD ["npm", "start"]

