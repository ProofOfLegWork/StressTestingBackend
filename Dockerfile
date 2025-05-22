FROM node:18-alpine

WORKDIR /app

# Install Docker CLI
RUN apk add --no-cache docker

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"] 