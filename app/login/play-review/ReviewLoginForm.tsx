"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const LOGIN_ERROR =
  "メールアドレスまたはパスワードが正しくありません";

export default function ReviewLoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await signIn("play-review", {
        email,
        password,
        callbackUrl: "/mypage",
        redirect: false,
      });

      if (!result?.ok || result.error) {
        setErrorMessage(LOGIN_ERROR);
        return;
      }

      router.replace(result.url || "/mypage");
      router.refresh();
    } catch {
      setErrorMessage(LOGIN_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
      <div>
        <label
          htmlFor="review-email"
          className="text-sm font-black text-slate-700"
        >
          審査専用メールアドレス
        </label>
        <input
          id="review-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label
          htmlFor="review-password"
          className="text-sm font-black text-slate-700"
        >
          パスワード
        </label>
        <input
          id="review-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm font-bold text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "確認中..." : "審査用アカウントでログイン"}
      </button>
    </form>
  );
}
