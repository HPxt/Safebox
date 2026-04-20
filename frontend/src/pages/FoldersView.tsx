import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Credential, CredentialFormData } from '../types'
import { credentialsService } from '../services/credentialsService'
import FolderManager from '../components/FolderManager'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  Key, 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2,
  ExternalLink,
  Menu,
  X,
  Save,
  Star as StarFilled,
  ArrowLeft
} from 'lucide-react'

const credentialInputClasses = 'w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const modalSecondaryButtonClasses = 'px-4 py-2 text-gray-600 dark:text-dark-700 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-md transition-colors'

const FoldersView: React.FC = () => {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [formData, setFormData] = useState<CredentialFormData>({
    title: '',
    username: '',
    email: '',
    password: '',
    website: '',
    notes: '',
    folderId: undefined,
    isFavorite: false
  })

  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      setLoading(true)
      const data = await credentialsService.getCredentials()
      
      // Normalizar dados para garantir que todos os campos necessários existam
      const normalizedData = Array.isArray(data) ? data.map(credential => ({
        ...credential,
        title: String(credential?.title || ''),
        username: String(credential?.username || ''),
        email: String(credential?.email || ''),
        website: String(credential?.website || ''),
        notes: String(credential?.notes || ''),
        folderId: credential?.folderId || undefined,
        isFavorite: Boolean(credential?.isFavorite)
      })) : []
      
      setCredentials(normalizedData)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const getFilteredCredentials = () => {
    try {
      if (!Array.isArray(credentials)) {
        return []
      }

      return credentials.filter(credential => {
        try {
          // Triple verification for credential object
          if (!credential || typeof credential !== 'object') {
            return false
          }

          // Validate required fields with forced string conversion
          const title = String(credential.title || '')
          const username = String(credential.username || '')
          const email = String(credential.email || '')
          const website = String(credential.website || '')

          // Search filter with error handling
          let matchesSearch = true
          if (searchTerm && searchTerm.trim()) {
            try {
              const search = searchTerm.toLowerCase()
              matchesSearch = [title, username, email, website].some(field => 
                field.toLowerCase().includes(search)
              )
            } catch {
              matchesSearch = false
            }
          }

          // Folder filter with error handling
          let matchesFolder = true
          if (selectedFolderId) {
            try {
              matchesFolder = credential.folderId === selectedFolderId
            } catch {
              matchesFolder = false
            }
          }

          return matchesSearch && matchesFolder
        } catch {
          return false
        }
      })
    } catch {
      return []
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCredential) {
        await credentialsService.updateCredential(editingCredential.id, formData)
      } else {
        await credentialsService.createCredential(formData)
      }
      await loadCredentials()
      resetForm()
    } catch {
      alert('Erro ao salvar credencial')
    }
  }

  const handleEdit = (credential: Credential) => {
    setEditingCredential(credential)
    setFormData({
      title: credential.title,
      username: credential.username || '',
      email: credential.email || '',
      password: '', // Não carregar senha por segurança
      website: credential.website || '',
      notes: credential.notes || '',
      folderId: credential.folderId,
      isFavorite: credential.isFavorite
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta credencial?')) {
      return
    }

    try {
      await credentialsService.deleteCredential(id)
      await loadCredentials()
    } catch {
      alert('Erro ao excluir credencial')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      username: '',
      email: '',
      password: '',
      website: '',
      notes: '',
      folderId: selectedFolderId,
      isFavorite: false
    })
    setEditingCredential(null)
    setShowForm(false)
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${field} copiado para a área de transferência!`)
    } catch {
      alert('Erro ao copiar para a área de transferência')
    }
  }

  const handleFolderSelect = (folderId: string | undefined) => {
    setSelectedFolderId(folderId)
  }

  const handleFolderChange = async () => {
    // Recarregar credenciais quando pastas mudarem
    await loadCredentials()
  }

  const filteredCredentials = getFilteredCredentials()

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-50 flex relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`fixed lg:relative bg-white dark:bg-dark-100 border-r border-gray-200 dark:border-dark-200 transition-all duration-300 z-50 h-full flex flex-col ${
          sidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full lg:w-0'
        } lg:translate-x-0 ${sidebarOpen ? 'lg:w-80' : 'lg:w-0'}`}>
          <div className="p-4 border-b border-gray-200 dark:border-dark-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 
                className="text-xl font-bold text-gray-900 dark:text-dark-900 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => navigate('/dashboard')}
                title="Voltar ao Dashboard"
              >
                SafeBox
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-gray-400 dark:text-dark-500 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">Organize suas credenciais</p>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            <FolderManager
              selectedFolderId={selectedFolderId}
              onFolderSelect={handleFolderSelect}
              onFolderChange={handleFolderChange}
            />
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-dark-200 bg-white dark:bg-dark-100">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-dark-700 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg mb-2 flex items-center transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </button>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-dark-700 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-white dark:bg-dark-100 border-b border-gray-200 dark:border-dark-200 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 text-gray-400 dark:text-dark-500 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                )}
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-dark-900 truncate">
                  {selectedFolderId ? 'Credenciais' : 'Pastas'}
                </h1>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-dark-500 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>
                
                <button
                  onClick={() => {
                    setFormData(prev => ({ ...prev, folderId: selectedFolderId }))
                    setShowForm(true)
                  }}
                  className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nova Credencial</span>
                  <span className="sm:hidden">Nova</span>
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 sm:h-32 sm:w-32 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCredentials.map((credential) => {
                  try {
                    // Safe access to credential properties
                    const title = String(credential?.title || 'Sem título')
                    const username = String(credential?.username || '')
                    const email = String(credential?.email || '')
                    const website = String(credential?.website || '')
                    
                    return (
                      <div
                        key={credential.id}
                        className="bg-white dark:bg-dark-100 rounded-lg shadow-sm dark:shadow-dark-200/20 border border-gray-200 dark:border-dark-200 p-4 hover:shadow-md dark:hover:shadow-dark-200/30 transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Key className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <h3 className="font-semibold text-gray-900 dark:text-dark-900 truncate">{title}</h3>
                          </div>
                          
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {credential.isFavorite && (
                              <StarFilled className="h-4 w-4 text-yellow-400 fill-current" />
                            )}
                            <button
                              onClick={() => handleEdit(credential)}
                              className="p-1 text-gray-400 dark:text-dark-500 hover:text-blue-600 dark:hover:text-blue-400 touch-target transition-colors"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(credential.id)}
                              className="p-1 text-gray-400 dark:text-dark-500 hover:text-red-600 dark:hover:text-red-400 touch-target transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {username && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 dark:text-dark-700 flex-shrink-0">Usuário:</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-dark-900 truncate">{username}</span>
                                <button
                                  onClick={() => copyToClipboard(username, 'Usuário')}
                                  className="p-1 text-gray-400 dark:text-dark-500 hover:text-blue-600 dark:hover:text-blue-400 touch-target flex-shrink-0 transition-colors"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          {email && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 dark:text-dark-700 flex-shrink-0">Email:</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-dark-900 truncate">{email}</span>
                                <button
                                  onClick={() => copyToClipboard(email, 'Email')}
                                  className="p-1 text-gray-400 dark:text-dark-500 hover:text-blue-600 dark:hover:text-blue-400 touch-target flex-shrink-0 transition-colors"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-gray-600 dark:text-dark-700 flex-shrink-0">Senha:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium font-mono text-gray-900 dark:text-dark-900">
                                {showPassword[credential.id] ? credential.encryptedPassword : '••••••••'}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility(credential.id)}
                                className="p-1 text-gray-400 dark:text-dark-500 hover:text-blue-600 dark:hover:text-blue-400 touch-target transition-colors"
                              >
                                {showPassword[credential.id] ? 
                                  <EyeOff className="h-3 w-3" /> : 
                                  <Eye className="h-3 w-3" />
                                }
                              </button>
                              <button
                                onClick={() => copyToClipboard(credential.encryptedPassword, 'Senha')}
                                className="p-1 text-gray-400 dark:text-dark-500 hover:text-blue-600 dark:hover:text-blue-400 touch-target transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {website && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 dark:text-dark-700 flex-shrink-0">Site:</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <a
                                  href={website.startsWith('http') ? website : `https://${website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:underline truncate"
                                >
                                  {website}
                                </a>
                                <ExternalLink className="h-3 w-3 text-gray-400 dark:text-dark-500 flex-shrink-0" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  } catch {
                    return null
                  }
                })}
                
                {filteredCredentials.length === 0 && !loading && (
                  <div className="col-span-full text-center py-8 sm:py-12 px-4">
                    <Key className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 dark:text-dark-500 mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-dark-900 mb-2">
                      {selectedFolderId ? 'Nenhuma credencial nesta pasta' : 'Nenhuma credencial encontrada'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-dark-700 mb-4 max-w-sm mx-auto">
                      {searchTerm ? 
                        'Tente ajustar os termos de busca' : 
                        'Comece adicionando suas primeiras credenciais'
                      }
                    </p>
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, folderId: selectedFolderId }))
                        setShowForm(true)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Credencial
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Modal de Formulário */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-100 rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-dark-200 shadow-xl">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 mb-4">
                  {editingCredential ? 'Editar Credencial' : 'Nova Credencial'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className={credentialInputClasses}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Usuário
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className={credentialInputClasses}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={credentialInputClasses}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Senha *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={credentialInputClasses}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      className={credentialInputClasses}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className={credentialInputClasses}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isFavorite"
                      checked={formData.isFavorite}
                      onChange={(e) => setFormData(prev => ({ ...prev, isFavorite: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isFavorite" className="ml-2 block text-sm text-gray-900 dark:text-dark-900">
                      Marcar como favorito
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className={modalSecondaryButtonClasses}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md flex items-center space-x-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>{editingCredential ? 'Salvar' : 'Criar'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

export default FoldersView 
