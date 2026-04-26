FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY fanvue_chatbot/DATABASE_SCHEMA.sql ../DATABASE_SCHEMA.sql

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
