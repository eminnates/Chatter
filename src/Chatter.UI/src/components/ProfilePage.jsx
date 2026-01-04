"use client"

import { useState, useEffect, useRef } from "react"
import { X, User, Mail, Camera, Save, LogOut, FileText } from "lucide-react"
import "./ProfilePage.css"

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
    <div className="profile-overlay">
      <div className="profile-modal">
        {/* Header */}
        <div className="profile-header">
          <h1 className="profile-title">Edit Profile</h1>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="profile-content">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-wrapper">
              {profileData.profilePictureUrl ? (
                <img src={profileData.profilePictureUrl || "/placeholder.svg"} alt="Profile" className="profile-img" />
              ) : (
                <div className="avatar-placeholder">
                  <User size={48} color="white" />
                </div>
              )}

              {/* Camera Button */}
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="camera-btn"
                    aria-label="Change profile picture"
                  >
                    <Camera size={20} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                </>
              )}
            </div>
            {isOwnProfile && <p className="avatar-hint">Click to change photo</p>}
          </div>

          {/* Form Fields */}
          <div className="form-section">
            {/* Full Name */}
            <div className="input-group">
              <label className="input-label">
                <User size={16} color="#10b981" /> Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={profileData.fullName}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                className="form-input"
                placeholder="Your full name"
              />
            </div>

            {/* Username */}
            <div className="input-group">
              <label className="input-label">
                <User size={16} color="#3b82f6" /> Username
              </label>
              <input
                type="text"
                name="userName"
                value={profileData.userName}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                className="form-input"
                placeholder="Username"
              />
            </div>

            {/* Email */}
            <div className="input-group">
              <label className="input-label">
                <Mail size={16} color="#6b7280" /> Email
              </label>
              <input
                type="email"
                name="email"
                value={profileData.email}
                disabled
                className="form-input"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>

            {/* About Me */}
            <div className="input-group">
              <label className="input-label">
                <FileText size={16} color="#a855f7" /> About Me
              </label>
              <textarea
                name="bio"
                value={profileData.bio}
                onChange={handleInputChange}
                disabled={!isOwnProfile || loading}
                rows={3}
                className="form-textarea"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="profile-footer">
          {isOwnProfile && (
            <button onClick={handleSave} disabled={loading} className="save-btn">
              {loading ? (
                <>
                  <div className="spinner" /> Saving...
                </>
              ) : (
                <>
                  <Save size={20} /> Save Changes
                </>
              )}
            </button>
          )}

          <button onClick={onLogout} className="logout-btn">
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
