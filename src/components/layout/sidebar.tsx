"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string; image?: string; role?: string }
    | undefined;
  const role = user?.role;
  const displayName = user?.name ?? "User";
  const initials = getInitials(displayName);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  const navItems = [
    { href: "/tickets", label: "Tickets" },
    { href: "/tickets/new", label: "New Ticket" },
    ...(role === "ADMIN" ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <Link href="/tickets" className="text-lg font-bold">
          CrustyHelpdesk
        </Link>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm mb-1 ${
                active
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile section */}
      <div className="border-t border-gray-700" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="w-full flex items-center gap-3 p-4 hover:bg-gray-800 transition-colors"
        >
          {user?.image ? (
            <img
              src={user.image}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {initials}
            </div>
          )}
          <span className="text-sm text-gray-200 truncate">{displayName}</span>
        </button>

        {menuOpen && (
          <div className="border-t border-gray-700 bg-gray-800">
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              View Profile
            </Link>
            <Link
              href="/profile/change-password"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Change Password
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
