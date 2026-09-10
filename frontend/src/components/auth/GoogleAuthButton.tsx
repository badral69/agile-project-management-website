import { useEffect, useRef } from "react";
import { env } from "../../config/env";

type GoogleAuthButtonProps = {
  mode?: "signin" | "signup" | "continue";
  onCredential: (credential: string) => Promise<void> | void;
  onError?: (message: string) => void;
};

const GOOGLE_SCRIPT_ID = "google-identity-services";
let gsiInitialized = false;
// Stable refs so the GSI callback always calls the latest handlers,
// even when initialize() only fires once across navigations.
let _onCredentialRef: ((credential: string) => Promise<void> | void) | null = null;
let _onErrorRef: ((message: string) => void) | undefined = undefined;

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Google Identity Services.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Google Identity Services."));
    document.head.appendChild(script);
  });

const buttonText = (mode: GoogleAuthButtonProps["mode"]) => {
  if (mode === "signup") {
    return "signup_with";
  }

  if (mode === "continue") {
    return "continue_with";
  }

  return "signin_with";
};

export function GoogleAuthButton({ mode = "signin", onCredential, onError }: GoogleAuthButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);

  // Keep module-level refs in sync on every render so the GSI callback
  // always dispatches to the current page's handler, not a stale one.
  _onCredentialRef = onCredential;
  _onErrorRef = onError;

  useEffect(() => {
    const clientId = env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      onError?.("Google sign-in is not configured yet.");
      return;
    }

    let cancelled = false;

    void loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
          return;
        }

        buttonRef.current.innerHTML = "";
        if (!gsiInitialized) {
          gsiInitialized = true;
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (!response.credential) {
                _onErrorRef?.("Google sign-in did not return a credential.");
                return;
              }
              void _onCredentialRef?.(response.credential);
            },
          });
        }
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: buttonText(mode),
          shape: "pill",
          width: buttonRef.current.offsetWidth || 320,
          logo_alignment: "left",
        });
      })
      .catch((error: Error) => {
        _onErrorRef?.(error.message);
      });

    return () => {
      cancelled = true;
      window.google?.accounts?.id.cancel?.();
    };
  }, [mode]); // onCredential/onError intentionally omitted — handled via module-level refs

  if (!env.VITE_GOOGLE_CLIENT_ID) {
    return <div className="google-auth-placeholder">Google sign-in will appear after `VITE_GOOGLE_CLIENT_ID` is configured.</div>;
  }

  return <div className="google-auth-button" ref={buttonRef} />;
}
