import type { NextAuthConfig } from "next-auth";

// Shared auth config — safe to import in Edge Runtime (middleware).
// Does NOT include providers that depend on Node.js packages (db, bcrypt).
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // Added in auth.ts for server-side use
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "TECHNICIAN";
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Allow auth routes
      if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
        return true;
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn) {
        return false; // NextAuth will redirect to signIn page
      }

      return true;
    },
  },
};
