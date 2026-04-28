import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { Credential, CredentialFormData } from '../types'
import { credentialsService } from '../services/credentialsService'
import ProtectedRoute from '../components/ProtectedRoute'
import CryptoService from '../services/cryptoService'
import { toCleanPublicUrl } from '../utils/urlSafety'
import { 
  ArrowLeft,
  EyeOff,
  Eye,
  Copy,
  Edit,
  Trash2,
  Star,
  Globe,
  User,
  X
} from 'lucide-react'

const HiddenCredentials: React.FC = () => {
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const navigate = useNavigate()
  
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})
  const [showModal, setShowModal] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [showPasswordInForm, setShowPasswordInForm] = useState(false)
  const [formData, setFormData] = useState<CredentialFormData>({
    title: '',
    username: '',
    email: '',
    password: '',
    website: '',
    notes: '',
    isFavorite: false,
    isHidden: true
  })

  // Redirecionar se não tiver permissão
  useEffect(() => {
    if (!preferences.showHiddenCredentials) {
      navigate('/dashboard')
    }
  }, [preferences.showHiddenCredentials, navigate])

  useEffect(() => {
    if (user && preferences.showHiddenCredentials) {
      fetchHiddenCredentials()
    }
  }, [user, preferences.showHiddenCredentials])

  const fetchHiddenCredentials = async () => {
    try {
      setLoading(true)
      const allCredentials = await credentialsService.getCredentials()
      // Filtrar apenas as credenciais ocultas
      const hiddenCredentials = allCredentials.filter(c => c.isHidden === true)
      setCredentials(hiddenCredentials)
    } catch {
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = (credentialId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }))
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Feedback visual poderia ser adicionado aqui
    } catch {
    }
  }

  const handleEdit = async (credential: Credential) => {
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      navigate('/dashboard')
      return
    }

    setEditingCredential(credential)
    setFormData({
      title: credential.title,
      username: credential.username || '',
      email: credential.email || '',
      password: credential.encryptedPassword || '',
      website: credential.website || '',
      notes: credential.notes || '',
      isFavorite: credential.isFavorite,
      isHidden: credential.isHidden
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCredential(null)
    setShowPasswordInForm(false)
    setFormData({
      title: '',
      username: '',
      email: '',
      password: '',
      website: '',
      notes: '',
      isFavorite: false,
      isHidden: true
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmitCredential = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        navigate('/dashboard')
        return
      }

      if (editingCredential) {
        await credentialsService.updateCredential(editingCredential.id, formData)
      }
      
      await fetchHiddenCredentials()
      handleCloseModal()
    } catch (error: any) {
      alert('Erro ao salvar credencial: ' + (error?.message || 'Erro desconhecido'))
    }
  }

  const handleDeleteCredential = async (id: string) => {
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      navigate('/dashboard')
      return
    }

    if (!window.confirm('Tem certeza que deseja excluir esta credencial permanentemente?')) {
      return
    }

    try {
      await credentialsService.deleteCredential(id)
      await fetchHiddenCredentials()
    } catch (error: any) {
      alert('Erro ao excluir credencial')
    }
  }

  const handleUnhideCredential = async (credential: Credential) => {
    try {
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        navigate('/dashboard')
        return
      }

      const updateData: CredentialFormData = {
        title: credential.title,
        username: credential.username || '',
        email: credential.email || '',
        password: '', // Manter senha atual
        website: credential.website || '',
        notes: credential.notes || '',
        isFavorite: credential.isFavorite,
        isHidden: false // Desocultar
      }

      await credentialsService.updateCredential(credential.id, updateData)
      await fetchHiddenCredentials()
    } catch (error: any) {
      alert('Erro ao desocultar credencial')
    }
  }

  if (!preferences.showHiddenCredentials) {
    return null
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-50">
        {/* Header */}
        <div className="bg-white dark:bg-dark-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-dark-700" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-900 flex items-center">
                  <EyeOff className="h-6 w-6 mr-2 text-amber-600" />
                  Credenciais Ocultas
                </h1>
                <p className="text-sm text-gray-500 dark:text-dark-600 mt-1">
                  {credentials.length} {credentials.length === 1 ? 'credencial oculta' : 'credenciais ocultas'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : credentials.length === 0 ? (
            <div className="bg-white dark:bg-dark-100 rounded-lg shadow-sm p-12 text-center">
              <EyeOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-900 mb-2">
                Nenhuma credencial oculta
              </h3>
              <p className="text-gray-600 dark:text-dark-700 mb-6">
                Para ocultar uma credencial, edite-a no Dashboard e marque a opção "Ocultar credencial".
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary"
              >
                Ir para o Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {credentials.map((credential) => (
                <div key={credential.id} className="bg-white dark:bg-dark-100 rounded-lg shadow-sm p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        {credential.website ? (
                          <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                        ) : (
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-900 truncate">
                            {String(credential.title || 'Sem título')}
                          </h3>
                          {credential.isFavorite && (
                            <Star className="h-4 w-4 text-yellow-500 ml-2 fill-current" />
                          )}
                          <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                            Oculto
                          </span>
                        </div>
                        
                        <div className="mt-1 space-y-1">
                          {credential.username && (
                            <div className="flex items-center text-sm text-gray-600 dark:text-dark-600">
                              <span className="font-medium mr-2">Usuário:</span>
                              <span className="truncate">{credential.username}</span>
                              <button
                                onClick={() => copyToClipboard(credential.username!, 'usuário')}
                                className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center text-sm text-gray-600 dark:text-dark-600">
                            <span className="font-medium mr-2">Senha:</span>
                            <span className="font-mono">
                              {showPasswords[credential.id] ? credential.encryptedPassword : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(credential.id)}
                              className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded"
                            >
                              {showPasswords[credential.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(credential.encryptedPassword, 'senha')}
                              className="ml-1 p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>

                          {toCleanPublicUrl(credential.website) && (
                            <div className="flex items-center text-sm text-gray-600 dark:text-dark-600">
                              <span className="font-medium mr-2">Site:</span>
                              <a
                                href={toCleanPublicUrl(credential.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700 truncate"
                              >
                                {toCleanPublicUrl(credential.website)}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUnhideCredential(credential)}
                        className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"
                        title="Desocultar credencial"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(credential)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg"
                        title="Editar credencial"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCredential(credential.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Excluir credencial"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal para editar credencial */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-dark-100 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b dark:border-dark-200">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-900">
                  Editar Credencial
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmitCredential} className="p-6 space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900"
                  />
                </div>
                
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900"
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInForm ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-dark-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900"
                      placeholder="Deixe em branco para manter a atual"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInForm(!showPasswordInForm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasswordInForm ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900"
                  />
                </div>
                
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isFavorite"
                    name="isFavorite"
                    checked={formData.isFavorite}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isFavorite" className="ml-2 block text-sm text-gray-900 dark:text-dark-900">
                    Marcar como favorito
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isHidden"
                    name="isHidden"
                    checked={formData.isHidden}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isHidden" className="ml-2 block text-sm text-gray-900 dark:text-dark-900">
                    Manter oculta
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-700 dark:text-dark-700 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-300 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

export default HiddenCredentials
