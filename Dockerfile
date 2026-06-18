# syntax=docker/dockerfile:1

# Build the Vite/React frontend.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Render exposes service environment variables as Docker build arguments.
# Vite variables are compiled into the browser bundle, so they must not be secrets.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_BASE=/api
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# Serve only the built frontend. Nginx also forwards /api-s4 to the existing backend.
FROM nginx:1.27-alpine

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Only substitute these variables in the Nginx template; preserve Nginx variables such as $uri.
ENV PORT=10000
ENV NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_ORIGIN)$"

EXPOSE 10000

CMD ["nginx", "-g", "daemon off;"]
