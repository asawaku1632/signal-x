"use client";

import { signIn } from "next-auth/react";

export default function GoogleLoginButton() {
  return (
    <button
      onClick={() =>
        signIn("google", {
          callbackUrl: "/dashboard",
        })
      }
      className="mt-8 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-200"
    >
      Googleでログイン
    </button>
  );
}
