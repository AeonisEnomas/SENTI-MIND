import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import { getErrorMessage } from "../lib/errors";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Keep in sync with the backend input caps.
export const MAX_ANALYSIS_CHARS = 5000;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from active Supabase session if available
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return config;
});

let signingOut = false;

// Normalise errors for the UI and handle expired sessions centrally.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (error) error.userMessage = getErrorMessage(error);

    if (status === 401 && !signingOut) {
      // The session is no longer valid. Signing out fires onAuthStateChange,
      // AuthContext clears the user, and ProtectedRoute redirects to /login.
      signingOut = true;
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (signOutError) {
        console.error("Sign-out after 401 failed:", signOutError);
      } finally {
        signingOut = false;
      }
    }
    return Promise.reject(error);
  }
);

export async function analyzeText(text) {
  const { data } = await api.post("/analysis/", { text });
  return data;
}

export default api;
