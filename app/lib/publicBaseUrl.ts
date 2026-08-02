const DEFAULT_PUBLIC_BASE_URL = "https://signal-x-ppjg.vercel.app";

export function getPublicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    DEFAULT_PUBLIC_BASE_URL
  ).replace(/\/$/, "");
}
