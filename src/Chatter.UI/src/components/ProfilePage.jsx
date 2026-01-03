import { useState, useEffect, useRef } from 'react'
import { User, Edit2, Save, X, Upload, Camera } from 'lucide-react'

export default function ProfilePage({ user, userId, currentUserId, token, API_URL, onUpdate, onClose, showToast }) {
  const isOwnProfile = !userId || userId === currentUserId
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    userName: user?.userName || '',
    email: user?.email || '',
    bio: user?.bio || '',
    profilePictureUrl: user?.profilePictureUrl || ''
  })
  const [originalData, setOriginalData] = useState({ ...profileData })
  const fileInputRef = useRef(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState(user?.profilePictureUrl || '')

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      // Eğer userId varsa ve kendi profilimiz değilse, o kullanıcının profilini getir
      const ownProfile = !userId || userId === currentUserId
      const endpoint = ownProfile 
        ? `${API_URL}/user/profile`
        : `${API_URL}/user/${userId}/profile`
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      })

      if (!response.ok) {
        throw new Error('Profil yüklenemedi')
      }

      const data = await response.json()
      const profile = {
        fullName: data.fullName || '',
        userName: data.userName || '',
        email: data.email || '',
        bio: data.bio || '',
        profilePictureUrl: data.profilePictureUrl || ''
      }
      
      setProfileData(profile)
      setOriginalData(profile)
      setProfilePicturePreview(data.profilePictureUrl || '')
    } catch (error) {
      showToast('Profil bilgileri yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Sadece resim dosyaları yüklenebilir', 'error')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Dosya boyutu 10MB\'dan küçük olmalıdır', 'error')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error?.message || 'Dosya yüklenemedi')
      }

      const uploadData = await uploadResponse.json()
      const fullUrl = uploadData.url.startsWith('http') 
        ? uploadData.url 
        : `${API_URL.replace('/api', '')}${uploadData.url}`

      setProfileData(prev => ({
        ...prev,
        profilePictureUrl: fullUrl
      }))
      setProfilePicturePreview(fullUrl)
      showToast('Profil fotoğrafı yüklendi', 'success')
    } catch (error) {
      showToast(error.message || 'Profil fotoğrafı yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      const response = await fetch(`${API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          fullName: profileData.fullName,
          userName: profileData.userName,
          bio: profileData.bio || null,
          profilePictureUrl: profileData.profilePictureUrl || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Profil güncellenemedi')
      }

      const updatedProfile = await response.json()
      setOriginalData({ ...profileData })
      setIsEditing(false)
      showToast('Profil başarıyla güncellendi', 'success')
      
      // Update parent component's user state
      if (onUpdate) {
        onUpdate({
          ...user,
          fullName: updatedProfile.fullName,
          userName: updatedProfile.userName,
          bio: updatedProfile.bio,
          profilePictureUrl: updatedProfile.profilePictureUrl
        })
      }
    } catch (error) {
      showToast(error.message || 'Profil güncellenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setProfileData({ ...originalData })
    setProfilePicturePreview(originalData.profilePictureUrl || '')
    setIsEditing(false)
  }

  if (loading && !profileData.userName) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button onClick={onClose} className="profile-close-btn">
          <X size={20} />
        </button>
        <h2>Profil</h2>
        {isOwnProfile && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="profile-edit-btn">
            <Edit2 size={18} />
            Düzenle
          </button>
        )}
      </div>

      <div className="profile-content">
        <div className="profile-picture-section">
          <div className="profile-picture-container">
            {profilePicturePreview ? (
              <img 
                src={profilePicturePreview} 
                alt="Profil" 
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-placeholder">
                <User size={48} />
              </div>
            )}
            {isOwnProfile && isEditing && (
              <div className="profile-picture-overlay">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="profile-picture-upload-btn"
                  disabled={loading}
                >
                  <Camera size={20} />
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        <div className="profile-form">
          <div className="profile-field">
            <label>Ad Soyad</label>
            {isOwnProfile && isEditing ? (
              <input
                type="text"
                value={profileData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Ad Soyad"
                disabled={loading}
              />
            ) : (
              <div className="profile-field-value">{profileData.fullName || '-'}</div>
            )}
          </div>

          <div className="profile-field">
            <label>Kullanıcı Adı</label>
            {isOwnProfile && isEditing ? (
              <input
                type="text"
                value={profileData.userName}
                onChange={(e) => handleInputChange('userName', e.target.value)}
                placeholder="Kullanıcı Adı"
                disabled={loading}
              />
            ) : (
              <div className="profile-field-value">{profileData.userName || '-'}</div>
            )}
          </div>

          {isOwnProfile && (
            <div className="profile-field">
              <label>E-posta</label>
              <div className="profile-field-value profile-field-readonly">
                {profileData.email || '-'}
              </div>
              <small className="profile-field-note">E-posta adresi değiştirilemez</small>
            </div>
          )}

          <div className="profile-field">
            <label>Hakkımda</label>
            {isOwnProfile && isEditing ? (
              <textarea
                value={profileData.bio || ''}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Hakkımda..."
                rows={4}
                disabled={loading}
              />
            ) : (
              <div className="profile-field-value">
                {profileData.bio || 'Henüz bir bilgi eklenmemiş'}
              </div>
            )}
          </div>

          {isEditing && (
            <div className="profile-actions">
              <button
                onClick={handleSave}
                className="profile-save-btn"
                disabled={loading}
              >
                {loading ? 'Kaydediliyor...' : (
                  <>
                    <Save size={18} />
                    Kaydet
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="profile-cancel-btn"
                disabled={loading}
              >
                <X size={18} />
                İptal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

