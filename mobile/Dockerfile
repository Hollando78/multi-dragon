FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --only=production
COPY . .
EXPOSE 3010
CMD ["npm", "start"]

