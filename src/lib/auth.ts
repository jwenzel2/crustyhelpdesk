import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { localProvider } from "@/lib/auth-providers/local";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [localProvider],
});
