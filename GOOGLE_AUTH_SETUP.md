# Google account sign-in setup

This frontend now supports **Continue with Google** in addition to the existing email/password account flow.

## Browser-to-backend flow

1. Google returns an ID token to the React frontend.
2. The frontend sends it to:

   ```text
   POST /api-s4/auth/google
   Content-Type: application/json

   {"credential":"<google-id-token>"}
   ```

3. The backend verifies the token with Google, creates the user when necessary, and returns a user object.
4. The frontend stores the returned user using the existing `AuthContext`.

The frontend accepts either of these response formats:

```json
{
  "id": 1,
  "email": "person@gmail.com",
  "name": "Person Name",
  "picture": "https://...",
  "role": "user"
}
```

or:

```json
{
  "user": {
    "id": 1,
    "email": "person@gmail.com",
    "name": "Person Name",
    "picture": "https://...",
    "role": "user"
  }
}
```

## Google Cloud configuration

Create a Google OAuth 2.0 Client ID of type **Web application**.

Add the frontend's exact Render origin under **Authorized JavaScript origins**, for example:

```text
https://s4-frontend.onrender.com
```

If you later create a service at the preferred address, also add:

```text
https://s3-bibliometric.onrender.com
```

For local development, add:

```text
http://localhost:5173
```

No redirect URI is needed for this Google Identity Services button flow.

## Render configuration

Set these environment variables on the Render web service:

```text
BACKEND_ORIGIN=http://130.225.37.120
VITE_API_BASE=/api-s4
VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` is compiled into the Vite bundle, so deploy again after changing it.

The Google button is hidden when `VITE_GOOGLE_CLIENT_ID` is missing, set to `not-used`, or does not end with `.apps.googleusercontent.com`.

## Backend requirement

The frontend alone cannot securely create Google accounts. The existing backend must implement:

```text
POST /api-s4/auth/google
```

The backend must verify at least the ID token's signature, `aud`, `iss`, `exp`, and `email_verified` claims. It should use Google's stable `sub` claim as the Google account identifier, create a local user on first sign-in, and return the user object shown above.

Do not trust a token merely because the frontend can decode it. Do not put a Google client secret in this frontend.
