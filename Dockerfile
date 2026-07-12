FROM node:20
WORKDIR /app

COPY package.json yarn.lock ./
COPY lib/models/schema.prisma ./lib/models/

RUN yarn install --frozen-lockfile

COPY . .
