FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
COPY ./prisma /app/prisma
COPY ./prisma.config.ts /app/prisma.config.ts
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
# Force prisma client regeneration from latest schema
RUN rm -rf /app/generated && npx prisma generate
RUN npm run build

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY ./prisma /app/prisma
COPY ./prisma.config.ts /app/prisma.config.ts
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/generated /app/generated
WORKDIR /app
CMD ["npm", "run", "start"]
