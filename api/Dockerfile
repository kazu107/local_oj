FROM node:20-bullseye

RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ python3 time openjdk-11-jdk-headless \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 4000

CMD ["node", "src/index.js"]
