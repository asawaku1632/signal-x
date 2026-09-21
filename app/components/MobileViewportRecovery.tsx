"use client";

import { useEffect } from "react";

const OAUTH_RECOVERY_KEY = "signalx-oauth-viewport-recovery";

export default function MobileViewportRecovery() {
  useEffect(() => {
    const recover = () => {
      if (document.visibilityState !== "visible") return;

      document.documentElement.style.width = "100%";
      document.body.style.width = "100%";
      window.dispatchEvent(new Event("resize"));

      if (sessionStorage.getItem(OAUTH_RECOVERY_KEY) !== "pending") return;

      sessionStorage.removeItem(OAUTH_RECOVERY_KEY);
      const url = new URL(window.location.href);
      url.searchParams.set("viewportRecovered", "1");
      window.location.replace(url.toString());
    };

    recover();
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);

    return () => {
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, []);

  return null;
}
