"use client";

import { useEffect } from "react";

export default function MobileViewportRecovery() {
  useEffect(() => {
    const recover = () => {
      document.documentElement.style.width = "100%";
      document.body.style.width = "100%";
      window.scrollTo({ left: 0, top: window.scrollY, behavior: "instant" as ScrollBehavior });
      window.dispatchEvent(new Event("resize"));
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
