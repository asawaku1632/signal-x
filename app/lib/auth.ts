import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  authorizePlayReview,
  getPlayReviewConfig,
  PLAY_REVIEW_PROVIDER_ID,
} from "@/app/lib/playReviewAuth";

const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  }),
];

if (getPlayReviewConfig()) {
  providers.push(
    CredentialsProvider({
      id: PLAY_REVIEW_PROVIDER_ID,
      name: "Google Play Review",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        return authorizePlayReview(credentials, request.headers ?? {});
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === PLAY_REVIEW_PROVIDER_ID) {
        const config = getPlayReviewConfig();
        if (!config) {
          throw new Error("Review authentication is unavailable");
        }

        token.authProvider = PLAY_REVIEW_PROVIDER_ID;
        token.reviewCredentialVersion = config.credentialVersion;
      }

      if (token.authProvider === PLAY_REVIEW_PROVIDER_ID) {
        const config = getPlayReviewConfig();
        if (
          !config ||
          token.reviewCredentialVersion !== config.credentialVersion
        ) {
          throw new Error("Review session has been revoked");
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        return `${baseUrl}/scan-mobile`;
      }

      return `${baseUrl}/scan-mobile`;
    },
  },
};
