FROM node:24-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/
RUN npm install --no-audit --no-fund

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
