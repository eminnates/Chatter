import { useState, useEffect } from 'react'
import { Settings, Save, X, TestTube, CheckCircle2, XCircle, Trash2, RefreshCw } from 'lucide-react'
import {
  getConfig,
  saveConfig,
  getUrlHistory,
  clearUrlHistory,
  testBackendConnection,
  autoDetectHubUrl,
  validateUrl,
  normalizeUrl
} from '../utils/config'

export default function SettingsPage({ onClose, onConfigChange, showToast }) {
  const [config, setConfig] = useState({ apiUrl: '', hubUrl: '' })
  const [urlHistory, setUrlHistory] = useState([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [autoDetecting, setAutoDetecting] = useState(false)

  useEffect(() => {
    loadConfig()
    loadHistory()
  }, [])

  const loadConfig = () => {
    const currentConfig = getConfig()
    setConfig({
      apiUrl: currentConfig.apiUrl || '',
      hubUrl: currentConfig.hubUrl || ''
    })
  }

  const loadHistory = () => {
    setUrlHistory(getUrlHistory())
  }

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
    setTestResult(null)
  }

  const handleAutoDetect = () => {
    if (!config.apiUrl) {
      showToast('Lütfen önce API URL girin', 'error')
      return
    }

    setAutoDetecting(true)
    const hubUrl = autoDetectHubUrl(config.apiUrl)
    setConfig(prev => ({
      ...prev,
      hubUrl: hubUrl
    }))
    setAutoDetecting(false)
    showToast('Hub URL otomatik olarak algılandı', 'success')
  }

  const handleTestConnection = async () => {
    if (!config.apiUrl) {
      showToast('Lütfen API URL girin', 'error')
      return
    }

    if (!validateUrl(config.apiUrl)) {
      setTestResult({ success: false, error: 'Geçersiz URL formatı' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await testBackendConnection(config.apiUrl)
      setTestResult(result)
      
      if (result.success) {
        showToast('Backend bağlantısı başarılı', 'success')
      } else {
        showToast(`Bağlantı hatası: ${result.error}`, 'error')
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message })
      showToast('Bağlantı testi sırasında hata oluştu', 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.apiUrl) {
      showToast('API URL gereklidir', 'error')
      return
    }

    if (!validateUrl(config.apiUrl)) {
      showToast('Geçersiz API URL formatı', 'error')
      return
    }

    if (config.hubUrl && !validateUrl(config.hubUrl)) {
      showToast('Geçersiz Hub URL formatı', 'error')
      return
    }

    setSaving(true)

    try {
      // Auto-detect hub URL if not provided
      const hubUrl = config.hubUrl || autoDetectHubUrl(config.apiUrl)
      
      const saved = saveConfig({
        apiUrl: config.apiUrl,
        hubUrl: hubUrl,
        ngrokSkipWarning: true
      })

      if (saved) {
        showToast('Ayarlar kaydedildi', 'success')
        if (onConfigChange) {
          // Pass base URL (without /api) - getApiUrl will add it automatically
          let baseApiUrl = normalizeUrl(config.apiUrl);
          baseApiUrl = baseApiUrl.replace(/\/api\/?$/, '');
          onConfigChange({
            apiUrl: baseApiUrl,
            hubUrl: normalizeUrl(hubUrl)
          })
        }
        loadHistory()
        onClose()
      } else {
        showToast('Ayarlar kaydedilemedi', 'error')
      }
    } catch (error) {
      showToast('Ayarlar kaydedilirken hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUseHistory = (url) => {
    setConfig(prev => ({
      ...prev,
      apiUrl: url,
      hubUrl: autoDetectHubUrl(url)
    }))
    setTestResult(null)
  }

  const handleClearHistory = () => {
    if (window.confirm('URL geçmişini temizlemek istediğinize emin misiniz?')) {
      clearUrlHistory()
      loadHistory()
      showToast('URL geçmişi temizlendi', 'success')
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button onClick={onClose} className="settings-close-btn">
          <X size={20} />
        </button>
        <h2>
          <Settings size={24} />
          Ayarlar
        </h2>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Backend Yapılandırması</h3>
          <p className="settings-description">
            Backend sunucunuzun URL'sini girin. Ngrok kullanıyorsanız, ngrok URL'nizi buraya girin.
          </p>

          <div className="settings-field">
            <label>
              API URL <span className="required">*</span>
            </label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => handleInputChange('apiUrl', e.target.value)}
              placeholder="https://your-ngrok-url.ngrok-free.dev"
              disabled={saving}
            />
            <small className="field-hint">
              Örnek: https://abc123.ngrok-free.dev ( /api otomatik eklenir)
            </small>
          </div>

          <div className="settings-field">
            <label>
              Hub URL (SignalR)
              <button
                onClick={handleAutoDetect}
                className="auto-detect-btn"
                disabled={!config.apiUrl || autoDetecting}
                title="API URL'den otomatik algıla"
              >
                {autoDetecting ? <RefreshCw size={14} className="spinning" /> : 'Otomatik Algıla'}
              </button>
            </label>
            <input
              type="text"
              value={config.hubUrl}
              onChange={(e) => handleInputChange('hubUrl', e.target.value)}
              placeholder="Otomatik algılanacak veya manuel girin"
              disabled={saving}
            />
            <small className="field-hint">
              Genellikle API URL + /hubs/chat
            </small>
          </div>

          <div className="settings-actions">
            <button
              onClick={handleTestConnection}
              className="test-btn"
              disabled={!config.apiUrl || testing || saving}
            >
              {testing ? (
                <>
                  <RefreshCw size={18} className="spinning" />
                  Test Ediliyor...
                </>
              ) : (
                <>
                  <TestTube size={18} />
                  Bağlantıyı Test Et
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? (
                <>
                  <CheckCircle2 size={20} />
                  <span>{testResult.message || 'Bağlantı başarılı'}</span>
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  <span>{testResult.error || 'Bağlantı başarısız'}</span>
                </>
              )}
            </div>
          )}

          {urlHistory.length > 0 && (
            <div className="url-history-section">
              <div className="url-history-header">
                <h4>Son Kullanılan URL'ler</h4>
                <button
                  onClick={handleClearHistory}
                  className="clear-history-btn"
                  title="Geçmişi temizle"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="url-history-list">
                {urlHistory.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseHistory(url)}
                    className="history-item"
                  >
                    {url}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button
            onClick={handleSave}
            className="save-btn"
            disabled={!config.apiUrl || saving || testing}
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="spinning" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save size={18} />
                Kaydet
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="cancel-btn"
            disabled={saving}
          >
            <X size={18} />
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}

