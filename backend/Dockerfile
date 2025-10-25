FROM node:18-alpine

WORKDIR /app

# Copiar package.json primeiro
COPY package*.json ./
RUN npm install

# Copiar arquivos de ambiente
COPY .env .env

# Copiar resto do código
COPY . .

EXPOSE 3000

CMD ["npm", "start"]