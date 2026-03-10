"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

const roleLabels: Record<string, string> = {
  CLIENT: "Client",
  LEVEL_1: "Level 1 Technician",
  LEVEL_2: "Level 2 Technician",
  LEVEL_3: "Level 3 Technician",
  ADMIN: "Administrator",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string; role?: string; image?: string } | undefined;
  const name = user?.name ?? "User";
  const initials = getInitials(name);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4 mb-6">
          {user?.image ? (
            <img
              src={user.image}
              alt={name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl font-bold">
              {initials}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Role</span>
            <p className="text-gray-900">{roleLabels[user?.role ?? ""] ?? user?.role}</p>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <Link
            href="/profile/change-password"
            className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
          >
            Change Password
          </Link>
        </div>
      </div>
    </div>
  );
}
