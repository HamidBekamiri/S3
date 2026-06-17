// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./styles.css";

const googleClientId = (
  import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
)?.trim();

const googleAuthEnabled = Boolean(
  googleClientId &&
    googleClientId !== "not-used" &&
    googleClientId.endsWith(".apps.googleusercontent.com")
);

const application = <App googleAuthEnabled={googleAuthEnabled} />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {googleAuthEnabled && googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        {application}
      </GoogleOAuthProvider>
    ) : (
      application
    )}
  </React.StrictMode>
);
