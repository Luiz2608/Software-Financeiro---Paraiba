FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
