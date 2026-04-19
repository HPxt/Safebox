import React, { useState } from 'react'
import { Eye, EyeOff, RefreshCw, Plus, Trash2, HelpCircle, Star } from 'lucide-react'

// Classes reutilizáveis para inputs que respeitam o tema
const inputClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
const selectClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
const textareaClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y"

interface CredentialFormData {
  title: string
  folderId: string | null
  username: string
  password: string
  totpSecret: string
  uris: string[]
  notes: string
  requireMasterPassword: boolean
  isFavorite: boolean
}

interface Folder {
  id: string
  name: string
  color: string
}

interface CredentialFormProps {
  initialData?: Partial<CredentialFormData>
  folders: Folder[]
  onSubmit: (data: CredentialFormData) => void
  onCancel: () => void
  onGeneratePassword: () => void
  isLoading?: boolean
  isEditing?: boolean
}

const CredentialForm: React.FC<CredentialFormProps> = ({
  initialData,
  folders,
  onSubmit,
  onCancel,
  onGeneratePassword,
  isLoading = false,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<CredentialFormData>({
    title: initialData?.title || '',
    folderId: initialData?.folderId || null,
    username: initialData?.username || '',
    password: initialData?.password || '',
    totpSecret: initialData?.totpSecret || '',
    uris: initialData?.uris || [''],
    notes: initialData?.notes || '',
    requireMasterPassword: initialData?.requireMasterPassword || false,
    isFavorite: initialData?.isFavorite || false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showTotp, setShowTotp] = useState(false)

  const handleChange = (field: keyof CredentialFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUriChange = (index: number, value: string) => {
    const newUris = [...formData.uris]
    newUris[index] = value
    setFormData(prev => ({ ...prev, uris: newUris }))
  }

  const addUri = () => {
    setFormData(prev => ({ ...prev, uris: [...prev.uris, ''] }))
  }

  const removeUri = (index: number) => {
    if (formData.uris.length > 1) {
      const newUris = formData.uris.filter((_, i) => i !== index)
      setFormData(prev => ({ ...prev, uris: newUris }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Detalhes do Item */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Detalhes do item
          </h3>
          <button
            type="button"
            onClick={() => handleChange('isFavorite', !formData.isFavorite)}
            className={`p-1 rounded ${formData.isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
          >
            <Star className={`h-5 w-5 ${formData.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Nome do item */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Nome do item <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={inputClasses}
              placeholder="Ex: Gmail, Facebook, etc."
              required
            />
          </div>

          {/* Pasta */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Pasta
            </label>
            <select
              value={formData.folderId || ''}
              onChange={(e) => handleChange('folderId', e.target.value || null)}
              className={inputClasses}
            >
              <option value="">Sem pasta</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Credenciais de Acesso */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Credenciais de acesso
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Usuário */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Nome de usuário
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className={`${inputClasses} pr-10`}
                placeholder="Nome de usuário"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className={`${inputClasses} pr-20`}
                placeholder="Senha"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={onGeneratePassword}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Use o gerador 🔄 para criar uma senha única e forte
            </p>
          </div>

          {/* TOTP */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              Chave do autenticador
              <HelpCircle className="h-3 w-3 text-gray-400" />
            </label>
            <div className="relative">
              <input
                type={showTotp ? 'text' : 'password'}
                value={formData.totpSecret}
                onChange={(e) => handleChange('totpSecret', e.target.value)}
                className={`${inputClasses} pr-10`}
                placeholder="Chave TOTP (opcional)"
              />
              <button
                type="button"
                onClick={() => setShowTotp(!showTotp)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showTotp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* URIs */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Opções de preenchimento automático
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
          {formData.uris.map((uri, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Site (URI)
                </label>
                <input
                  type="url"
                  value={uri}
                  onChange={(e) => handleUriChange(index, e.target.value)}
                  className={inputClasses}
                  placeholder="https://exemplo.com"
                />
              </div>
              {formData.uris.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUri(index)}
                  className="self-end p-2 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={addUri}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Adicionar site
          </button>
        </div>
      </div>

      {/* Opções Adicionais */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Opções adicionais
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Notas */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Anotações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className={textareaClasses}
              placeholder="Anotações adicionais..."
            />
          </div>

          {/* Resolicitar senha mestre - Desativado temporariamente */}
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 disabled:opacity-50"
          disabled={isLoading || !formData.title}
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

export default CredentialForm
