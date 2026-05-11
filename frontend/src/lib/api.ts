import axios, { AxiosHeaders } from "axios";
import { env } from "../config/env";

export const api = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
});

const csrfCookieName = "agile_csrf_token";
let csrfBootstrapPromise: Promise<void> | null = null;

const readCookie = (name: string) => {
  if (typeof document === "undefined") {
    return "";
  }

  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];

  return value ? decodeURIComponent(value) : "";
};

const ensureCsrfToken = async () => {
  if (readCookie(csrfCookieName)) {
    return;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get("/auth/csrf")
      .then(() => undefined)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  await csrfBootstrapPromise;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return config;
  }

  await ensureCsrfToken();
  const csrfToken = readCookie(csrfCookieName);

  if (csrfToken) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("x-csrf-token", csrfToken);
    } else {
      config.headers = AxiosHeaders.from({
        ...(config.headers || {}),
        "x-csrf-token": csrfToken,
      });
    }
  }

  return config;
});

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
};
