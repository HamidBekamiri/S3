// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import axios from "axios";
import { getAccessToken } from "./authToken";
import App from "./App";
import "./styles.css";

axios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

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
