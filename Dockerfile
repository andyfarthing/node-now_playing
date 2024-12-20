# Stage 1: Build Stage
FROM node:22-alpine AS build-stage

# Install necessary build dependencies (git is included in alpine)
RUN apk add --no-cache git

# Set working directory
WORKDIR /prolink-connect

# Clone the GitHub repository
RUN git clone https://github.com/andyfarthing/prolink-connect.git .

# Install dependencies and build the project in a single step to reduce layers
RUN npm install && npm run build

# Stage 2: Production Stage
FROM node:22-alpine AS production-stage
ENV NODE_ENV=production

WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
COPY . .
RUN npm install && npm run build
# Copy built files from the build stage
COPY --from=build-stage /prolink-connect /node_modules/prolink-connect
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
