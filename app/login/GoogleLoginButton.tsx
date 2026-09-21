"use client";

import { signIn } from "next-auth/react";

const OAUTH_RECOVERY_KEY = "signalx-oauth-viewport-recovery";

export default function GoogleLoginButton() {
  return (
    <button
      onClick={() => {
        sessionStorage.setItem(OAUTH_RECOVERY_KEY, "pending");
        void signIn("google", {
          callbackUrl: "/dashboard",
        });
      }}
      className="mt-8 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-200"
    >
      Googleでログイン
    </button>
  );
}
