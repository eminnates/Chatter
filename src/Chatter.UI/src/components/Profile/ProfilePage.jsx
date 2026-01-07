"use client"

import { useState, useEffect, useRef } from "react"
import { X, User, Mail, Camera, Save, LogOut, FileText, Loader2 } from "lucide-react"

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

  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    userName: user?.userName || "",
    email: user?.email || "",
    bio: user?.bio || "",
    profilePictureUrl: user?.profilePictureUrl || "",
  })

  const fileInputRef = useRef(null)

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
      setProfileData({
        fullName: data.fullName || "",
        userName: data.userName || "",
        email: data.email || "",
        bio: data.bio || "",
        profilePictureUrl: data.profilePictureUrl || "",
      })
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

  const handleFileSelect = async (e) => {
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

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("file", file)

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
      const fullUrl = uploadData.url.startsWith("http")
        ? uploadData.url
        : `${API_URL.replace("/api", "")}${uploadData.url}`

      setProfileData((prev) => ({
        ...prev,
        profilePictureUrl: fullUrl,
      }))

      if (showToast) showToast("Profile picture updated", "success")
    } catch (error) {
      if (showToast) showToast(error.message || "An error occurred", "error")
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          fullName: profileData.fullName,
          userName: profileData.userName,
          bio: profileData.bio || null,
          profilePictureUrl: profileData.profilePictureUrl || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Profile could not be updated")
      }

      const updatedProfile = await response.json()
      if (showToast) showToast("Profile saved successfully", "success")

      if (onUpdate) {
        onUpdate({
          ...user,
          fullName: updatedProfile.fullName,
          userName: updatedProfile.userName,
          bio: updatedProfile.bio,
          profilePictureUrl: updatedProfile.profilePictureUrl,
        })
      }
    } catch (error) {
      if (showToast) showToast(error.message || "Error updating profile", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    // Overlay: Mobilde tam ekran, Masaüstünde karartılmış arka plan
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      
      {/* Modal Container */}
      <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md bg-bg-card md:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-bg-sidebar border-b border-white/5">
          <h1 className="text-lg font-bold bg-gradient-to-r from-accent-primary via-accent-purple to-accent-warm bg-clip-text text-transparent">
            {isOwnProfile ? 'Edit Profile' : 'User Profile'}
          </h1>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-text-muted hover:bg-white/10 hover:text-text-main transition-colors active:scale-95"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-32 h-32 group">
              {profileData.profilePictureUrl ? (
                <img 
                  src={profileData.profilePictureUrl} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover border-4 border-bg-card shadow-lg ring-2 ring-accent-primary/20" 
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-accent-primary to-accent-purple flex items-center justify-center border-4 border-bg-card shadow-lg ring-2 ring-accent-primary/20">
                  <User size={48} className="text-white drop-shadow-md" />
                </div>
              )}

              {/* Camera Button (Only for own profile) */}
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="absolute bottom-0 right-0 p-2.5 bg-accent-primary hover:bg-accent-hover text-white rounded-full shadow-md transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Change photo"
                  >
                    <Camera size={18} />
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
            {isOwnProfile && <p className="text-xs text-text-muted">Tap camera icon to change</p>}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <User size={14} className="text-accent-primary" /> Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={profileData.fullName}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                className="w-full px-4 py-3 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Your full name"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <User size={14} className="text-accent-purple" /> Username
              </label>
              <input
                type="text"
                name="userName"
                value={profileData.userName}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                className="w-full px-4 py-3 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Username"
              />
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <Mail size={14} className="text-accent-warm" /> Email
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-4 py-3 bg-bg-main/50 border border-white/5 rounded-xl text-text-muted cursor-not-allowed"
              />
            </div>

            {/* About Me */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <FileText size={14} className="text-indigo-400" /> About Me
              </label>
              <textarea
                name="bio"
                value={profileData.bio}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                rows={3}
                className="w-full px-4 py-3 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-bg-sidebar border-t border-white/5 space-y-3 pb-safe-bottom">
          {isOwnProfile && (
            <button 
              onClick={handleSave} 
              disabled={loading} 
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-accent-primary to-accent-hover shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={20} /> Save Changes
                </>
              )}
            </button>
          )}

          <button 
            onClick={onLogout} 
            className="w-full py-3.5 rounded-xl font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}