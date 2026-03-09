import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const localProvider = Credentials({
  name: "Local",
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const username = credentials?.username as string | undefined;
    const password = credentials?.password as string | undefined;

    if (!username || !password) return null;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.passwordHash) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      name: user.displayName,
      email: user.email,
      role: user.role,
    };
  },
});
