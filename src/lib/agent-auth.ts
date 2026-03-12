import { prisma } from "./db";
import bcrypt from "bcryptjs";

export async function validateAgentToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Find all agent tokens and compare hashes
  const tokens = await prisma.agentToken.findMany();
  for (const agentToken of tokens) {
    const matches = await bcrypt.compare(token, agentToken.tokenHash);
    if (matches) {
      return agentToken;
    }
  }

  return null;
}
