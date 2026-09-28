FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json autarkeia.project.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
ARG ZERO_BUILD_SHA=unknown
ARG ZERO_BUILT_AT=
ENV ZERO_BUILD_SHA=$ZERO_BUILD_SHA ZERO_BUILT_AT=$ZERO_BUILT_AT PORT=8080
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
