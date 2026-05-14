FROM node:20-slim

RUN apt-get update && apt-get install -y git --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /workbench

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
COPY bin/ ./bin/

RUN npx tsc

EXPOSE 4141

ENV WORKBENCH_PORT=4141

# Mount target repo at /workspace
VOLUME ["/workspace"]

ENTRYPOINT ["node", "dist/server.js"]
CMD ["/workspace"]
