"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, User, Mail, Camera, Save, LogOut, FileText, Loader2, Edit3, Calendar, ArrowLeft, Check, RotateCw } from "lucide-react"
import Cropper from "react-easy-crop"
import { BACKEND_URL } from "../../config/constants"

function resolveProfilePicture(url) {
  if (!url) return null
  if (url.startsWith("http")) return url
  return `${BACKEND_URL}${url}`
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas = document.createElement("canvas")
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext("2d")

  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], "profile.jpg", { type: "image/jpeg" }))
    }, "image/jpeg", 0.9)
  })
}

export default function ProfilePage({
  user,
  userId,
  currentUserId,
  token,
  API_URL,
  onUpdate,
  onClose,
  onLogout,
  showToast,
}) {
  const isOwnProfile = !userId || userId === currentUserId
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    userName: user?.userName || "",
    email: user?.email || "",
    bio: user?.bio || "",
    profilePictureUrl: user?.profilePictureUrl || "",
    createdAt: user?.createdAt || "",
    isOnline: user?.isOnline || false,
  })

  const [originalData, setOriginalData] = useState(null)
  const fileInputRef = useRef(null)

  // Crop state
  const [cropImage, setCropImage] = useState(null) // data URL of selected image
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const ownProfile = !userId || userId === currentUserId
      const endpoint = ownProfile ? `${API_URL}/user/profile` : `${API_URL}/user/${userId}/profile`

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      })

      if (!response.ok) throw new Error("Profile could not be loaded")

      const data = await response.json()
      const loaded = {
        fullName: data.fullName || "",
        userName: data.userName || "",
        email: data.email || "",
        bio: data.bio || "",
        profilePictureUrl: data.profilePictureUrl || "",
        createdAt: data.createdAt || "",
        isOnline: data.isOnline ?? false,
      }
      setProfileData(loaded)
      setOriginalData(loaded)
    } catch (error) {
      if (showToast) showToast("Error loading profile information", "error")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const saveProfile = async (overrideData = {}) => {
    const dataToSave = { ...profileData, ...overrideData }
    try {
      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          fullName: dataToSave.fullName,
          userName: dataToSave.userName,
          bio: dataToSave.bio || null,
          profilePictureUrl: dataToSave.profilePictureUrl || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Profile could not be updated")
      }

      const updatedProfile = await response.json()

      const updated = {
        fullName: updatedProfile.fullName || dataToSave.fullName,
        userName: updatedProfile.userName || dataToSave.userName,
        email: dataToSave.email,
        bio: updatedProfile.bio || "",
        profilePictureUrl: updatedProfile.profilePictureUrl || dataToSave.profilePictureUrl,
        createdAt: dataToSave.createdAt,
        isOnline: dataToSave.isOnline,
      }
      setProfileData(updated)
      setOriginalData(updated)

      if (onUpdate) {
        onUpdate({
          ...user,
          fullName: updated.fullName,
          userName: updated.userName,
          bio: updated.bio,
          profilePictureUrl: updated.profilePictureUrl,
        })
      }

      return true
    } catch (error) {
      if (showToast) showToast(error.message || "Error updating profile", "error")
      return false
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const ok = await saveProfile()
      if (ok) {
        if (showToast) showToast("Profile saved successfully", "success")
        setIsEditing(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (originalData) setProfileData(originalData)
    setIsEditing(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      if (showToast) showToast("Only image files can be uploaded", "error")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      if (showToast) showToast("File size must be less than 10MB", "error")
      return
    }

    // Read file and open crop modal
    const reader = new FileReader()
    reader.onload = () => {
      setCropImage(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels) return

    try {
      setUploading(true)
      setCropImage(null)

      const croppedFile = await getCroppedImg(cropImage, croppedAreaPixels)

      const formData = new FormData()
      formData.append("file", croppedFile)

      const uploadResponse = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error?.message || "File could not be uploaded")
      }

      const uploadData = await uploadResponse.json()
      const relativeUrl = uploadData.url

      setProfileData((prev) => ({ ...prev, profilePictureUrl: relativeUrl }))

      const ok = await saveProfile({ profilePictureUrl: relativeUrl })
      if (ok) {
        if (showToast) showToast("Profile picture updated", "success")
      }
    } catch (error) {
      if (showToast) showToast(error.message || "An error occurred", "error")
    } finally {
      setUploading(false)
    }
  }

  const isDirty = originalData && (
    profileData.fullName !== originalData.fullName ||
    profileData.userName !== originalData.userName ||
    profileData.bio !== originalData.bio
  )

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return null
    }
  }

  const avatarUrl = resolveProfilePicture(profileData.profilePictureUrl)
  const memberSince = formatDate(profileData.createdAt)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md bg-bg-card md:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-bg-sidebar border-b border-border-subtle">
          <button
            onClick={onClose}
            className="p-2 rounded-full text-text-muted hover:bg-bg-hover hover:text-text-main transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-text-main">
            {isOwnProfile ? "Profile" : "User Profile"}
          </h1>
          {isOwnProfile ? (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-full transition-colors active:scale-95 ${isEditing ? "bg-accent-primary/20 text-accent-primary" : "text-text-muted hover:bg-bg-hover hover:text-text-main"}`}
              aria-label="Edit profile"
            >
              <Edit3 size={18} />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Banner + Avatar */}
          <div className="relative">
            {/* Gradient Banner */}
            <div className="h-28 bg-gradient-to-br from-accent-primary/30 via-accent-purple/20 to-accent-warm/15" />

            {/* Avatar - overlapping banner */}
            <div className="flex flex-col items-center -mt-16 relative z-10">
              <div className="relative">
                <div className="w-32 h-32 rounded-full ring-4 ring-bg-card shadow-lg overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex"; }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center"
                    style={{ display: avatarUrl ? "none" : "flex" }}
                  >
                    <User size={48} className="text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Upload overlay */}
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={32} />
                  </div>
                )}

                {/* Camera button */}
                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-1 right-1 p-2.5 bg-accent-primary hover:bg-accent-hover text-white rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50"
                      aria-label="Change photo"
                    >
                      <Camera size={16} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {/* Name & Username */}
              <div className="mt-3 text-center px-6">
                <h2 className="text-xl font-bold text-text-main">
                  {profileData.fullName || profileData.userName || "User"}
                </h2>
                {profileData.userName && (
                  <p className="text-sm text-text-muted mt-0.5">@{profileData.userName}</p>
                )}

                {/* Online status */}
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span className={`w-2 h-2 rounded-full ${profileData.isOnline ? "bg-accent-secondary" : "bg-text-subtle"}`} />
                  <span className="text-xs text-text-muted">
                    {profileData.isOnline ? "Online" : "Offline"}
                  </span>
                </div>

                {/* Member since */}
                {memberSince && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <Calendar size={12} className="text-text-subtle" />
                    <span className="text-xs text-text-subtle">Member since {memberSince}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="px-5 py-5 space-y-3">

            {/* Email Card */}
            <div className="bg-bg-main/50 rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center gap-2 mb-1.5">
                <Mail size={14} className="text-accent-primary" />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email</span>
              </div>
              <p className="text-sm text-text-main pl-[22px]">{profileData.email || "—"}</p>
            </div>

            {/* Full Name Card (edit mode) */}
            {isOwnProfile && isEditing && (
              <div className="bg-bg-main/50 rounded-2xl p-4 border border-border-subtle">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-accent-primary" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Full Name</span>
                </div>
                <input
                  type="text"
                  name="fullName"
                  value={profileData.fullName}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3 py-2.5 bg-bg-card border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all disabled:opacity-60"
                  placeholder="Your full name"
                />
              </div>
            )}

            {/* Username Card (edit mode) */}
            {isOwnProfile && isEditing && (
              <div className="bg-bg-main/50 rounded-2xl p-4 border border-border-subtle">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-accent-purple" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Username</span>
                </div>
                <input
                  type="text"
                  name="userName"
                  value={profileData.userName}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3 py-2.5 bg-bg-card border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all disabled:opacity-60"
                  placeholder="Username"
                />
              </div>
            )}

            {/* About Card */}
            <div className="bg-bg-main/50 rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={14} className="text-accent-purple" />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">About</span>
              </div>
              {isOwnProfile && isEditing ? (
                <textarea
                  name="bio"
                  value={profileData.bio}
                  onChange={handleInputChange}
                  disabled={loading}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-bg-card border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none disabled:opacity-60"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-sm text-text-main pl-[22px]">
                  {profileData.bio || <span className="text-text-subtle italic">No bio yet</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Crop Modal */}
        {cropImage && (
          <div className="absolute inset-0 z-20 bg-bg-card flex flex-col">
            {/* Crop Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-bg-sidebar border-b border-border-subtle">
              <button
                onClick={() => setCropImage(null)}
                className="p-2 rounded-full text-text-muted hover:bg-bg-hover hover:text-text-main transition-colors active:scale-95"
                aria-label="Cancel"
              >
                <X size={20} />
              </button>
              <h2 className="text-base font-bold text-text-main">Crop Photo</h2>
              <button
                onClick={handleCropConfirm}
                className="p-2 rounded-full text-accent-primary hover:bg-accent-primary/10 transition-colors active:scale-95"
                aria-label="Confirm crop"
              >
                <Check size={22} />
              </button>
            </div>

            {/* Crop Area */}
            <div className="flex-1 relative bg-black">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom Slider */}
            <div className="px-6 py-4 bg-bg-sidebar border-t border-border-subtle flex items-center gap-3">
              <RotateCw
                size={14}
                className="text-text-muted cursor-pointer hover:text-text-main transition-colors"
                onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}
              />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1 accent-accent-primary"
              />
              <span className="text-xs text-text-muted w-10 text-right">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-bg-sidebar border-t border-border-subtle space-y-2.5 pb-safe-bottom">
          {isOwnProfile && isEditing && isDirty && (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 rounded-xl font-semibold text-text-muted bg-bg-hover border border-border-subtle active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-accent-primary to-accent-hover shadow-lg shadow-accent-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving...</>
                ) : (
                  <><Save size={18} /> Save</>
                )}
              </button>
            </div>
          )}

          {isOwnProfile && (
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Log Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
