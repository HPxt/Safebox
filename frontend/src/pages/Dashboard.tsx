import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { useNavigate } from 'react-router-dom'
import { Credential, CredentialFormData } from '../types'
import { credentialsService } from '../services/credentialsService'
import ProtectedRoute from '../components/ProtectedRoute'
import MasterPasswordModal from '../components/MasterPasswordModal'
import TwoFactorSetup from '../components/TwoFactorSetup'
import ImportExport from '../components/ImportExport'
import ItemFormModal from '../components/ItemFormModal'
import ThemeToggle from '../components/ThemeToggle'
import SimpleGlowCard from '../components/ui/SimpleGlowCard'
import CryptoService from '../services/cryptoService'
import TwoFactorService from '../services/twoFactorService'
import { supabase } from '../config/supabase'
import { toCleanPublicUrl } from '../utils/urlSafety'
import { 
  Shield, 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2,
  Star,
  Globe,
  User,
  LogOut,
  Settings,
  X,
  Key,
  FolderOpen,
  Lock,
  Unlock,
  Smartphone,
  Download,
  EyeOffIcon
} from 'lucide-react'

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const { preferences } = usePreferences()
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})
  const [showModal, setShowModal] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [showMasterPasswordModal, setShowMasterPasswordModal] = useState(false)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false)
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [has2FAEnabled, setHas2FAEnabled] = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)
  const [showPasswordInForm, setShowPasswordInForm] = useState(false)
  const [showSecurityDetails, setShowSecurityDetails] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  
  // Log inicial para debug
  
  const [formData, setFormData] = useState<CredentialFormData>({
    title: '',
    username: '',
    email: '',
    password: '',
    website: '',
    notes: '',
    isFavorite: false,
    isHidden: false
  })

  useEffect(() => {
    const check2FAStatus = async () => {
      if (user?.id) {
        try {
          const isEnabled = await TwoFactorService.check2FAStatus(user.id)
          setHas2FAEnabled(isEnabled)
        } catch {
          setHas2FAEnabled(false)
        }
      }
    }

    const checkCryptoSetup = async () => {
      try {
        // Configurar listeners de atividade para controle de sessão
        CryptoService.setupActivityListeners()

        // Verificar se há chave armazenada na sessão
        const storedKey = await CryptoService.getStoredKey()
        if (storedKey) {
          // Já tem chave na sessão, vault já foi desbloqueado
          setIsVaultUnlocked(true)
          await fetchCredentials()
          return
        }

        // Não tem chave, verificar se o usuário já tem KDF configurado
        const { data: userData } = await supabase
          .from('users')
          .select('kdf_salt')
          .eq('id', user!.id)
          .single()

        if (!userData?.kdf_salt) {
          // Primeira vez - precisa configurar senha-mestra
          setIsFirstTimeSetup(true)
          setShowMasterPasswordModal(true)
        } else {
          // Já tem KDF - precisa desbloquear
          setIsFirstTimeSetup(false)
          setShowMasterPasswordModal(true)
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      checkCryptoSetup()
      check2FAStatus()
    }
  }, [user])

  useEffect(() => {
    if (!showSecurityDetails) {
      return
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSecurityDetails(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return () => window.removeEventListener('keydown', handleEscapeKey)
  }, [showSecurityDetails])

  const fetchCredentials = async () => {
    try {
      const data = await credentialsService.getCredentials()
      if (Array.isArray(data)) {
        setCredentials(data)
      } else {
        setCredentials([])
      }
    } catch {
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }

  const handleMasterPasswordSuccess = async () => {
    setIsVaultUnlocked(true)
    setShowMasterPasswordModal(false)
    await fetchCredentials()
  }

  const handle2FASetupSuccess = () => {
    setShow2FASetup(false)
    setHas2FAEnabled(true)
  }

  const handleLockVault = async () => {
    // Limpar chave da memória
    CryptoService.clearStoredKey()
    setIsVaultUnlocked(false)
    setCredentials([])
    
    // Quando bloquear manualmente, NUNCA é primeira vez
    // (se fosse primeira vez, não teria como estar desbloqueado)
    setIsFirstTimeSetup(false)
    setShowMasterPasswordModal(true)
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
      // Aqui você pode adicionar uma notificação de sucesso
    } catch {
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
    }
  }

  const handleOpenModal = async () => {
    // Verificar se a chave realmente existe antes de permitir operação
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      // Chave expirou ou foi perdida - sincronizar estado
      setIsVaultUnlocked(false)
      setIsFirstTimeSetup(false) // Não é primeira vez, apenas expirou
      setShowMasterPasswordModal(true)
      return
    }
    
    // Abrir o novo modal de seleção de tipo
    setShowItemModal(true)
    return
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
      isHidden: false
    })
  }

  const handleEdit = async (credential: Credential) => {
    // Verificar se a chave ainda está válida antes de permitir edição
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      setIsVaultUnlocked(false)
      setIsFirstTimeSetup(false)
      setShowMasterPasswordModal(true)
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
      isHidden: credential.isHidden || false
    })
    setShowModal(true)
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
      // Verificar se a chave ainda está válida antes de tentar salvar
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        // Chave expirou durante a edição - redirecionar para desbloqueio
        handleCloseModal()
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }

      if (editingCredential) {
        await credentialsService.updateCredential(editingCredential.id, formData)
      } else {
        await credentialsService.createCredential(formData)
      }
      
      await fetchCredentials()
      handleCloseModal()
    } catch (error: any) {
      
      // Tratar erro específico de vault bloqueado
      if (error?.message?.includes('Vault está bloqueado') || error?.message?.includes('bloqueado')) {
        handleCloseModal()
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }
      
      alert('Erro ao salvar credencial: ' + (error?.message || 'Erro desconhecido'))
    }
  }

  // Handler para salvar itens do novo modal (credential, card, etc)
  const handleSaveItem = async (type: string, data: any) => {
    try {
      // Verificar se a chave ainda está válida
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        setShowItemModal(false)
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }

      if (type === 'credential') {
        // Converter dados do novo formato para o formato esperado pelo service
        const credentialData: CredentialFormData = {
          title: data.title,
          username: data.username || '',
          email: '', // Campo não existe no novo form
          password: data.password || '',
          website: data.uris?.[0] || '',
          notes: data.notes || '',
          isFavorite: data.isFavorite || false,
          // Novos campos para o banco
          totp_secret: data.totpSecret || null,
          require_master_password: data.requireMasterPassword || false,
          item_type: 'credential'
        }
        await credentialsService.createCredential(credentialData)
      } else if (type === 'card') {
        // Converter dados do cartão para o formato de credencial
        const cardData: CredentialFormData = {
          title: data.title,
          username: data.cardHolderName || '',
          email: '',
          password: data.cardNumber?.replace(/\s/g, '') || '', // Número do cartão criptografado
          website: '',
          notes: data.notes || '',
          isFavorite: data.isFavorite || false,
          // Campos específicos de cartão
          card_holder_name: data.cardHolderName || null,
          card_number: data.cardNumber?.replace(/\s/g, '') || null,
          card_brand: data.cardBrand || null,
          card_exp_month: data.cardExpMonth || null,
          card_exp_year: data.cardExpYear || null,
          card_cvv: data.cardCvv || null,
          require_master_password: data.requireMasterPassword || false,
          item_type: 'card'
        }
        await credentialsService.createCredential(cardData)
      } else if (type === 'note') {
        // Anotação simples
        const noteData: CredentialFormData = {
          title: data.title,
          username: '',
          email: '',
          password: '', // Notas não tem senha
          website: '',
          notes: data.notes || '',
          isFavorite: data.isFavorite || false,
          require_master_password: data.requireMasterPassword || false,
          item_type: 'note'
        }
        await credentialsService.createCredential(noteData)
      } else if (type === 'identity') {
        // Identidade - dados pessoais e documentos
        const identityData: CredentialFormData = {
          title: data.title,
          username: data.username || '',
          email: '',
          password: data.cpf || '', // CPF como dado sensível principal
          website: '',
          notes: data.notes || '',
          isFavorite: data.isFavorite || false,
          require_master_password: data.requireMasterPassword || false,
          item_type: 'identity',
          // Campos extras serão salvos no notes como JSON
        }
        // Adicionar dados extras no notes
        const extraData = {
          personalTitle: data.personalTitle,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          company: data.company,
          cpf: data.cpf,
          passport: data.passport,
          licenseNumber: data.licenseNumber,
          originalNotes: data.notes
        }
        identityData.notes = JSON.stringify(extraData)
        await credentialsService.createCredential(identityData)
      } else if (type === 'ssh_key') {
        // Chave SSH
        const sshData: CredentialFormData = {
          title: data.title,
          username: data.fingerprint || '',
          email: '',
          password: data.privateKey || '', // Chave privada como dado sensível
          website: data.publicKey || '', // Chave pública no website
          notes: data.notes || '',
          isFavorite: data.isFavorite || false,
          require_master_password: data.requireMasterPassword || false,
          item_type: 'ssh_key'
        }
        await credentialsService.createCredential(sshData)
      }

      await fetchCredentials()
      setShowItemModal(false)
    } catch (error: any) {
      
      if (error?.message?.includes('Vault está bloqueado') || error?.message?.includes('bloqueado')) {
        setShowItemModal(false)
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }
      
      alert('Erro ao salvar: ' + (error?.message || 'Erro desconhecido'))
    }
  }

  const handleDeleteCredential = async (id: string) => {
    // Verificar se a chave ainda está válida
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      setIsVaultUnlocked(false)
      setIsFirstTimeSetup(false)
      setShowMasterPasswordModal(true)
      return
    }

    if (!window.confirm('Tem certeza que deseja excluir esta credencial?')) {
      return
    }

    try {
      await credentialsService.deleteCredential(id)
      await fetchCredentials()
    } catch (error: any) {
      
      // Tratar erro de vault bloqueado
      if (error?.message?.includes('Vault está bloqueado') || error?.message?.includes('bloqueado')) {
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }
      
      alert('Erro ao excluir credencial')
    }
  }

  const handleToggleFavorite = async (id: string, currentFavoriteStatus: boolean) => {
    try {
      // Verificar se a chave ainda está válida
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }

      // Encontrar a credencial atual
      const credential = credentials.find(c => c.id === id)
      if (!credential) {
        return
      }

      // Criar objeto com formato CredentialFormData
      const updateData: CredentialFormData = {
        title: credential.title,
        username: credential.username || '',
        email: credential.email || '',
        password: '', // Senha vazia significa manter a atual
        website: credential.website || '',
        notes: credential.notes || '',
        isFavorite: !currentFavoriteStatus
      }

      // Atualizar no banco
      await credentialsService.updateCredential(id, updateData)
      
      // Recarregar credenciais
      await fetchCredentials()
    } catch (error: any) {
      
      // Tratar erro de vault bloqueado
      if (error?.message?.includes('Vault está bloqueado') || error?.message?.includes('bloqueado')) {
        setIsVaultUnlocked(false)
        setIsFirstTimeSetup(false)
        setShowMasterPasswordModal(true)
        return
      }
      
      alert('Erro ao alterar favorito')
    }
  }

  // Garantir que credentials seja sempre um array antes de usar filter
  const safeCredentials = Array.isArray(credentials) ? credentials : []
  
  const filteredCredentials = (Array.isArray(safeCredentials) ? safeCredentials : []).filter(credential => {
    // Proteção contra credential undefined ou campos undefined
    if (!credential || typeof credential !== 'object' || !credential.id) {
      return false
    }

    // Filtrar credenciais ocultas - não mostrar no dashboard principal
    if (credential.isHidden === true) {
      return false
    }

    try {
      const searchLower = searchTerm.toLowerCase()
      const title = credential.title ? String(credential.title).toLowerCase() : ''
      const username = credential.username ? String(credential.username).toLowerCase() : ''
      const website = credential.website ? String(credential.website).toLowerCase() : ''
      
      return title.includes(searchLower) ||
             username.includes(searchLower) ||
             website.includes(searchLower)
    } catch {
      return false
    }
  })

  // Não mostrar tela branca de loading - apenas continua renderizando normalmente
  // O loading será indicado de forma mais sutil dentro da página

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-secondary-50 dark:bg-dark-50 overflow-x-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-dark-100 shadow-sm border-b border-secondary-200 dark:border-dark-200 w-full">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-4 gap-3">
              {/* Logo e Status */}
              <div className="flex items-center min-w-0">
                <div className="h-8 w-8 bg-safebox-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="ml-3 min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-secondary-900 dark:text-dark-900 truncate flex items-center gap-2">
                    SafeBox
                    {loading && (
                      <span className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                    )}
                  </h1>
                  <p className="text-xs text-secondary-600 dark:text-dark-600">
                    {isVaultUnlocked ? (
                      <span className="flex items-center text-green-600">
                        <Unlock className="w-3 h-3 mr-1" />
                        Desbloqueado
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600">
                        <Lock className="w-3 h-3 mr-1" />
                        Bloqueado
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Actions - Responsivo */}
              <div className="flex flex-wrap items-center gap-2 text-sm w-full sm:w-auto justify-end">
                {/* Theme Toggle */}
                <ThemeToggle />
                
                {/* Botões principais */}
                <button
                  onClick={() => navigate('/generator')}
                  className="flex items-center px-2 sm:px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  <Key className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Gerador</span>
                  <span className="sm:hidden">Gen</span>
                </button>
                
                {isVaultUnlocked && (
                  <>
                    <button
                      onClick={handleLockVault}
                      className="flex items-center px-2 sm:px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs sm:text-sm whitespace-nowrap"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Bloquear</span>
                      <span className="sm:hidden">Lock</span>
                    </button>
                    
                    {!has2FAEnabled && (
                      <button
                        onClick={() => setShow2FASetup(true)}
                        className="flex items-center px-2 sm:px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm whitespace-nowrap"
                      >
                        <Smartphone className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">2FA</span>
                        <span className="sm:hidden">2FA</span>
                      </button>
                    )}
                  </>
                )}
                
                {/* User info - Responsivo */}
                <div className="hidden md:flex items-center text-xs sm:text-sm text-secondary-600 min-w-0">
                  <span className="truncate max-w-32">
                    {user?.email?.split('@')[0] || 'Usuário'}
                  </span>
                  {has2FAEnabled && (
                    <span title="2FA Ativo">
                      <Shield className="h-4 w-4 ml-1 text-green-600 flex-shrink-0" />
                    </span>
                  )}
                </div>
                
                {/* Menu buttons */}
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center text-xs sm:text-sm text-secondary-600 hover:text-secondary-900 px-2 py-2 rounded-md hover:bg-secondary-100"
                  title="Configurações"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Config</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center text-xs sm:text-sm text-secondary-600 hover:text-secondary-900 px-2 py-2 rounded-md hover:bg-secondary-100"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo principal - apenas quando desbloqueado */}
        {isVaultUnlocked ? (
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6">
            <SimpleGlowCard glowColor="blue" intensity="medium">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-secondary-600 dark:text-dark-600">Total de Credenciais</p>
                  <p className="text-2xl font-bold text-secondary-900 dark:text-dark-900">{safeCredentials.length}</p>
                </div>
              </div>
            </SimpleGlowCard>

            <SimpleGlowCard glowColor="orange" intensity="medium">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-secondary-600 dark:text-dark-600">Favoritos</p>
                  <p className="text-2xl font-bold text-secondary-900 dark:text-dark-900">
                    {(() => {
                      try {
                        return Array.isArray(safeCredentials) ? safeCredentials.filter(c => c && c.isFavorite).length : 0
                      } catch {
                        return 0
                      }
                    })()}
                  </p>
                </div>
              </div>
            </SimpleGlowCard>

            <div 
              className="card p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => setShowSecurityDetails(true)}
            >
              <div className="flex items-center">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-secondary-600">Segurança</p>
                  <div className="mt-1">
                    <p className="text-sm font-bold text-green-600">AES-256-GCM</p>
                    <p className="text-xs text-secondary-500 mt-1">
                      {has2FAEnabled ? (
                        <span className="flex items-center">
                          <Shield className="h-3 w-3 mr-1 text-green-500" />
                          2FA Ativo • PBKDF2 + Argon2id
                        </span>
                      ) : (
                        <span>PBKDF2 (100k) + Argon2id</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
            <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-secondary-400" />
              </div>
              <input
                type="text"
                className="input-field pl-10 w-full"
                placeholder="Buscar credenciais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => navigate('/folders')}
                className="btn-secondary flex items-center text-sm px-3 py-2"
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Pastas</span>
                <span className="sm:hidden">📁</span>
              </button>
              
              <button
                onClick={() => navigate('/generator')}
                className="btn-secondary flex items-center text-sm px-3 py-2 lg:hidden"
              >
                <Key className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Gerador</span>
                <span className="sm:hidden">🔑</span>
              </button>
              
              <button
                onClick={() => setShowImportExport(true)}
                className="btn-secondary flex items-center text-sm px-3 py-2"
              >
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Import/Export</span>
                <span className="sm:hidden">💾</span>
              </button>
              
              {/* Botão Ocultos - só aparece se a preferência estiver ativada */}
              {preferences.showHiddenCredentials && (
                <button
                  onClick={() => navigate('/hidden')}
                  className="btn-secondary flex items-center text-sm px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  <EyeOffIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Ocultos</span>
                </button>
              )}
              
              <button
                onClick={handleOpenModal}
                className="btn-primary flex items-center text-sm px-3 py-2 flex-1 sm:flex-initial"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span>Nova Credencial</span>
              </button>
            </div>
          </div>

          {/* Credentials List */}
          <div className="space-y-4">
            {filteredCredentials.length === 0 ? (
              <div className="card p-12 text-center">
                <Shield className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  {safeCredentials.length === 0 ? 'Nenhuma credencial ainda' : 'Nenhuma credencial encontrada'}
                </h3>
                <p className="text-secondary-600 mb-6">
                  {safeCredentials.length === 0 
                    ? 'Comece adicionando sua primeira credencial para manter suas senhas seguras.'
                    : 'Tente ajustar sua busca ou adicionar uma nova credencial.'
                  }
                </p>
                <button 
                  onClick={handleOpenModal}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Credencial
                </button>
              </div>
            ) : (
              filteredCredentials.map((credential) => (
                <div key={credential.id} className="card p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {credential.website ? (
                          <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                        ) : (
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-secondary-900 dark:text-dark-900 truncate">
                            {String(credential.title || 'Sem título')}
                          </h3>
                          {credential.isFavorite && (
                            <Star className="h-4 w-4 text-yellow-500 ml-2" />
                          )}
                        </div>
                        
                        <div className="mt-1 space-y-1">
                          {credential.username && (
                            <div className="flex items-center text-sm text-secondary-600 dark:text-dark-600">
                              <span className="font-medium mr-2">Usuário:</span>
                              <span className="truncate">{credential.username}</span>
                              <button
                                onClick={() => copyToClipboard(credential.username!, 'usuário')}
                                className="ml-2 p-1 hover:bg-secondary-100 dark:hover:bg-dark-200 rounded"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {credential.email && (
                            <div className="flex items-center text-sm text-secondary-600 dark:text-dark-600">
                              <span className="font-medium mr-2">Email:</span>
                              <span className="truncate">{credential.email}</span>
                              <button
                                onClick={() => copyToClipboard(credential.email!, 'email')}
                                className="ml-2 p-1 hover:bg-secondary-100 dark:hover:bg-dark-200 rounded"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center text-sm text-secondary-600 dark:text-dark-600">
                            <span className="font-medium mr-2">Senha:</span>
                            <span className="font-mono">
                              {showPasswords[credential.id] ? credential.encryptedPassword : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(credential.id)}
                              className="ml-2 p-1 hover:bg-secondary-100 dark:hover:bg-dark-200 rounded"
                            >
                              {showPasswords[credential.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(credential.encryptedPassword, 'senha')}
                              className="ml-1 p-1 hover:bg-secondary-100 dark:hover:bg-dark-200 rounded"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>

                          {toCleanPublicUrl(credential.website) && (
                            <div className="flex items-center text-sm text-secondary-600 dark:text-dark-600">
                              <span className="font-medium mr-2">Site:</span>
                              <a
                                href={toCleanPublicUrl(credential.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-safebox-500 hover:text-safebox-600 dark:text-safebox-400 dark:hover:text-safebox-300 truncate"
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
                        onClick={() => handleToggleFavorite(credential.id, credential.isFavorite)}
                        className={`p-2 rounded-lg transition-colors ${
                          credential.isFavorite 
                            ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' 
                            : 'text-secondary-400 hover:text-yellow-500 hover:bg-yellow-50 dark:text-dark-500 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/20'
                        }`}
                        title={credential.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        <Star className={`h-4 w-4 ${credential.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={() => handleEdit(credential)}
                        className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 dark:text-dark-500 dark:hover:text-dark-700 dark:hover:bg-dark-200 rounded-lg"
                        title="Editar credencial"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCredential(credential.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg"
                        title="Excluir credencial"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[calc(100vh-120px)] bg-gray-100 dark:bg-gray-800">
            <div className="text-center max-w-md mx-auto p-8 pt-60">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700 mb-6">
                <Lock className="h-10 w-10 text-gray-500 dark:text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">Vault Bloqueado</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
                Digite a senha da sua conta para acessar suas credenciais.
              </p>
              <button
                onClick={() => setShowMasterPasswordModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
              >
                Desbloquear Vault
              </button>
            </div>
          </div>
        )}

        {/* Modal para adicionar/editar credencial */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingCredential ? 'Editar Credencial' : 'Nova Credencial'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-500 dark:text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmitCredential} className="p-6 space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                    placeholder="Ex: Gmail, Facebook, etc."
                  />
                </div>
                
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                    placeholder="Nome de usuário"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                    placeholder="seu@email.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInForm ? "text" : "password"}
                      id="password"
                      name="password"
                      required={!editingCredential}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                      placeholder={editingCredential ? "Deixe em branco para manter a atual" : "Senha"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInForm(!showPasswordInForm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasswordInForm ? (
                        <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                    placeholder="https://exemplo.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                    placeholder="Notas adicionais..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isFavorite"
                    name="isFavorite"
                    checked={formData.isFavorite}
                    onChange={handleInputChange}
                    className="h-5 w-5 rounded border-2 border-gray-300 dark:border-zinc-500 bg-white dark:bg-zinc-700 text-blue-600 focus:ring-blue-500 focus:ring-2 checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
                  />
                  <label htmlFor="isFavorite" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    Marcar como favorito
                  </label>
                </div>

                {/* Só mostra opção de ocultar se a preferência estiver ativada */}
                {preferences.showHiddenCredentials && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isHidden"
                      name="isHidden"
                      checked={formData.isHidden}
                      onChange={handleInputChange}
                      className="h-5 w-5 rounded border-2 border-gray-300 dark:border-zinc-500 bg-white dark:bg-zinc-700 text-amber-600 focus:ring-amber-500 focus:ring-2 checked:bg-amber-600 checked:border-amber-600 cursor-pointer"
                    />
                    <label htmlFor="isHidden" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Ocultar credencial
                    </label>
                    {formData.isHidden && (
                      <span className="ml-2 text-xs text-amber-600">
                        (será movida para a seção Ocultos)
                      </span>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-zinc-700 mt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-gray-300 dark:border-zinc-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    {editingCredential ? 'Salvar' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Desbloqueio do Vault */}
        {showMasterPasswordModal && (
          <MasterPasswordModal
            isOpen={showMasterPasswordModal}
            isFirstTime={isFirstTimeSetup}
            canClose={isVaultUnlocked}
            onSuccess={handleMasterPasswordSuccess}
            onClose={() => {
              // Só permite fechar se o vault estiver desbloqueado
              if (isVaultUnlocked) {
                setShowMasterPasswordModal(false)
              }
              // Se o vault estiver bloqueado, não faz nada (não fecha)
            }}
          />
        )}

        {/* Novo Modal de Criação de Item (Credencial, Cartão, etc) */}
        <ItemFormModal
          isOpen={showItemModal}
          onClose={() => setShowItemModal(false)}
          onSave={handleSaveItem}
          folders={[]}
          onGeneratePassword={() => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
            let password = ''
            for (let i = 0; i < 16; i++) {
              password += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            navigator.clipboard.writeText(password)
            alert('Senha gerada e copiada: ' + password)
          }}
        />

        {/* Modal de Configuração 2FA */}
        {show2FASetup && user && (
          <TwoFactorSetup
            isOpen={show2FASetup}
            onClose={() => setShow2FASetup(false)}
            onSuccess={handle2FASetupSuccess}
          />
        )}

        {/* Modal de Importação/Exportação */}
        {showImportExport && (
          <ImportExport
            isOpen={showImportExport}
            onClose={() => setShowImportExport(false)}
            onImportComplete={fetchCredentials}
          />
        )}

        {/* Modal de Detalhes de Segurança */}
        {showSecurityDetails && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowSecurityDetails(false)}
          >
            <div
              className="bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-200 rounded-lg max-w-md w-full shadow-xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="security-details-title"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-200">
                <h2 id="security-details-title" className="text-lg font-semibold text-secondary-900 dark:text-dark-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-600" />
                  Detalhes de Segurança
                </h2>
                <button
                  type="button"
                  onClick={() => setShowSecurityDetails(false)}
                  className="p-2 text-secondary-500 dark:text-dark-500 hover:text-secondary-900 dark:hover:text-dark-900 hover:bg-secondary-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
                  aria-label="Fechar detalhes de segurança"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Lock className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-dark-900">Criptografia AES-256-GCM</p>
                      <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                        Padrão militar de criptografia com chaves de 256 bits. Suas senhas são criptografadas localmente antes de serem salvas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Key className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-dark-900">KDF Híbrido (PBKDF2 + Argon2id)</p>
                      <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                        Dupla camada de derivação: PBKDF2 com 100.000 iterações seguido de Argon2id com 64MB de memória. Proteção contra ataques de força bruta.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-dark-900">Zero-Knowledge</p>
                      <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                        Nem mesmo nós temos acesso às suas senhas. Apenas você possui a chave de descriptografia.
                      </p>
                    </div>
                  </div>

                  {has2FAEnabled ? (
                    <div className="flex items-start space-x-3">
                      <Smartphone className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-secondary-900 dark:text-dark-900">2FA Ativado ✓</p>
                        <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                          Autenticação de dois fatores ativa. Proteção adicional contra acesso não autorizado.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-3">
                      <Smartphone className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-secondary-900 dark:text-dark-900">2FA Desativado</p>
                        <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                          Recomendamos ativar a autenticação de dois fatores para proteção adicional.
                        </p>
                        <button
                          onClick={() => {
                            setShowSecurityDetails(false)
                            setShow2FASetup(true)
                          }}
                          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                          Ativar 2FA agora →
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-3">
                    <Eye className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-secondary-900 dark:text-dark-900">Ocultação Automática</p>
                      <p className="text-sm text-secondary-600 dark:text-dark-700 mt-1">
                        Senhas são ocultadas por padrão e só são reveladas quando você escolhe visualizá-las.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>Dica de Segurança:</strong> Use senhas únicas e fortes para cada conta. 
                    O gerador de senhas pode criar senhas seguras automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </ProtectedRoute>
  )
}

export default Dashboard 

