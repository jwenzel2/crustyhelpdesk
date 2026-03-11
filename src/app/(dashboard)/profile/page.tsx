"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Profile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  jobRole: string | null;
  avatarUrl: string | null;
}

function getCroppedImageBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<string> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    256,
    256,
  );

  return Promise.resolve(canvas.toDataURL("image/png"));
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [jobRole, setJobRole] = useState("");

  // Avatar crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setProfile(data);
    } catch {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  function startEditing() {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setEmail(profile.email);
    setPhoneNumber(profile.phoneNumber ?? "");
    setJobRole(profile.jobRole ?? "");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, phoneNumber, jobRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save profile");
        return;
      }

      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height);
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    setCrop({ unit: "px", x, y, width: size, height: size });
  }, []);

  async function handleCropSave() {
    if (!imgRef.current || !completedCrop) return;

    setUploadingAvatar(true);
    setError("");

    try {
      const dataUrl = await getCroppedImageBlob(imgRef.current, completedCrop);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to upload avatar");
        return;
      }

      const { avatarUrl } = await res.json();
      setProfile((prev) => prev ? { ...prev, avatarUrl } : prev);
      setCropModalOpen(false);
      setImageSrc(null);
    } catch {
      setError("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setError("");
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove avatar");
        return;
      }
      setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev);
    } catch {
      setError("Failed to remove avatar");
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
        <div className="bg-white rounded-lg shadow-md p-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
        <div className="bg-white rounded-lg shadow-md p-6 text-red-600">
          {error || "Could not load profile"}
        </div>
      </div>
    );
  }

  const initials = getInitials(profile.displayName);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl font-bold">
                  {initials}
                </div>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 truncate">{profile.displayName}</h2>
              <p className="text-sm text-gray-500 truncate">{profile.email}</p>
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEditing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex-shrink-0"
            >
              Edit Profile
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4 border-t pt-4">
            {/* Avatar actions in edit mode */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                Upload Photo
              </button>
              {profile.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100"
                >
                  Remove Photo
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={100}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={20}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Role</label>
              <input
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                maxLength={100}
                placeholder="e.g. Manager, QA, Developer"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Name</span>
              <p className="text-gray-900">{profile.displayName}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Email</span>
              <p className="text-gray-900">{profile.email}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Phone Number</span>
              <p className="text-gray-900">{profile.phoneNumber || "\u2014"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Role</span>
              <p className="text-gray-900">{profile.jobRole || "\u2014"}</p>
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <Link
            href="/profile/change-password"
            className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
          >
            Change Password
          </Link>
        </div>
      </div>

      {/* Crop Modal */}
      {cropModalOpen && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Crop Profile Photo</h3>
            <div className="flex justify-center mb-4">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "60vh", maxWidth: "100%", display: "block" }}
                />
              </ReactCrop>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setCropModalOpen(false);
                  setImageSrc(null);
                }}
                disabled={uploadingAvatar}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                disabled={uploadingAvatar || !completedCrop}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading..." : "Save Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
