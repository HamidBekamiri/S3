# Deploy the S4 frontend to Render with Docker

This image contains only the compiled React frontend and Nginx. The backend remains on the existing server.

## Required architecture

Browser -> Render frontend/Nginx -> existing backend

Nginx forwards every request beginning with `/api-s4/` to `BACKEND_ORIGIN`. This keeps API requests same-origin from the browser and normally avoids changing backend CORS settings.

## Render deployment

1. Push this folder to a GitHub, GitLab, or Bitbucket repository.
2. In Render, create a **Blueprint** from the repository, or create a **Web Service** and select **Docker**.
3. Set these environment variables:
   - `BACKEND_ORIGIN`: the public origin of the existing backend server, such as `https://server.example.com`. Do not include `/api-s4` and do not add a trailing slash.
   - `VITE_GOOGLE_CLIENT_ID`: the existing Google OAuth web client ID.
4. Deploy.
5. In Google Cloud Console, add the Render URL, such as `https://s4-frontend.onrender.com`, to the OAuth client's **Authorized JavaScript origins**.

## Backend requirements

- The backend must be reachable from the public internet by the Render service.
- Prefer a valid HTTPS certificate on the backend.
- The backend must continue serving its API under `/api-s4`.
- Any backend-generated activation/reset links should point to the new frontend domain if those links currently contain the old frontend URL.

## Local Docker test

```bash
docker build \
  --build-arg VITE_API_BASE=/api-s4 \
  --build-arg VITE_GOOGLE_CLIENT_ID=your-client-id \
  -t s4-frontend .

docker run --rm -p 10000:10000 \
  -e BACKEND_ORIGIN=https://your-current-server.example.com \
  s4-frontend
```

Open `http://localhost:10000`.

## Alternative: Render Static Site

A Static Site is cheaper and simpler for a Vite frontend, but it cannot perform this Nginx reverse proxy. In that setup, set `VITE_API_BASE` to the backend's full HTTPS API URL and enable CORS on the backend for the Render frontend domain.
