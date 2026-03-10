// All roles in the system
export const ROLES = ["CLIENT", "LEVEL_1", "LEVEL_2", "LEVEL_3", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: "Client",
  LEVEL_1: "Level 1 Tech",
  LEVEL_2: "Level 2 Tech",
  LEVEL_3: "Level 3 Tech",
  ADMIN: "Admin",
};

// Technician roles (any tech level)
export function isTech(role: string): boolean {
  return role === "LEVEL_1" || role === "LEVEL_2" || role === "LEVEL_3";
}

// Staff = any tech or admin
export function isStaff(role: string): boolean {
  return isTech(role) || role === "ADMIN";
}
