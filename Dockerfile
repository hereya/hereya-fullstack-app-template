FROM --platform=linux/amd64 node:22-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM --platform=linux/amd64 node:22-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
COPY ./prisma /app/prisma
COPY ./prisma.config.ts /app/prisma.config.ts
WORKDIR /app
RUN npm ci --omit=dev

FROM --platform=linux/amd64 node:22-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM --platform=linux/amd64 node:22-alpine
COPY ./package.json package-lock.json /app/
COPY ./prisma /app/prisma
COPY ./prisma.config.ts /app/prisma.config.ts
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/app/generated /app/app/generated
WORKDIR /app
CMD ["npm", "run", "start"]
