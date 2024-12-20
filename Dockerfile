# Stage 1: Build Stage
FROM node:22 AS build-stage

# Install Git to clone the repository
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /prolink-connect

# Clone the GitHub repository (replace <repo-url> with the actual URL)
RUN git clone https://github.com/andyfarthing/prolink-connect.git .

# Install dependencies
RUN npm install

# Build the project
RUN npm run build

# Stage 2: Production Stage
FROM node:22-alpine AS production-stage
ENV NODE_ENV=production

WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install
COPY . .
RUN npm run build
# Copy built files from the build stage
COPY --from=build-stage /prolink-connect /node_modules/prolink-connect
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
