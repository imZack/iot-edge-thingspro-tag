FROM node:8-slim

COPY package.json /app/

WORKDIR /app

RUN npm install --production

COPY . /app

CMD ["node", "app.js"]

