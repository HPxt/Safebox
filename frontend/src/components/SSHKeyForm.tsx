import React, { useState } from 'react'
import { Eye, EyeOff, Star, Plus, X, ExternalLink } from 'lucide-react'

// Classes reutilizáveis para inputs que respeitam o tema
const inputClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
const selectClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
const textareaClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y font-mono text-sm"

interface SSHKeyFormData {
  title: string
  folderId: string | null
  privateKey: string
  publicKey: string
  fingerprint: string
  notes: string
  requireMasterPassword: boolean
  isFavorite: boolean
}

interface Folder {
  id: string
  name: string
  color: string
}

interface SSHKeyFormProps {
  initialData?: Partial<SSHKeyFormData>
  folders: Folder[]
  onSubmit: (data: SSHKeyFormData) => void
  onCancel: () => void
  isLoading?: boolean
  isEditing?: boolean
}

const SSHKeyForm: React.FC<SSHKeyFormProps> = ({
  initialData,
  folders,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<SSHKeyFormData>({
    title: initialData?.title || '',
    folderId: initialData?.folderId || null,
    privateKey: initialData?.privateKey || '',
    publicKey: initialData?.publicKey || '',
    fingerprint: initialData?.fingerprint || '',
    notes: initialData?.notes || '',
    requireMasterPassword: initialData?.requireMasterPassword || false,
    isFavorite: initialData?.isFavorite || false,
  })

  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showBanner, setShowBanner] = useState(true)

  const handleChange = (field: keyof SSHKeyFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Banner informativo */}
      {showBanner && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 relative">
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
          <h4 className="text-white font-medium mb-1">
            Acesso SSH amigável para desenvolvedores
          </h4>
          <p className="text-gray-300 text-sm">
            Armazene suas chaves e conecte com o agente SSH para uma autenticação rápida e criptografada.{' '}
            <a href="#" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
              Saiba mais sobre o agente SSH
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      )}

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
              placeholder=""
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
              className={selectClasses}
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

      {/* Chave SSH */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Chave SSH
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Chave Privada */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Chave privada
            </label>
            <div className="relative">
              <textarea
                value={formData.privateKey}
                onChange={(e) => handleChange('privateKey', e.target.value)}
                rows={3}
                className={`${textareaClasses} pr-10`}
                placeholder=""
                style={{ 
                  WebkitTextSecurity: showPrivateKey ? 'none' : 'disc',
                  fontFamily: 'monospace'
                } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Chave Pública */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Chave pública
            </label>
            <textarea
              value={formData.publicKey}
              onChange={(e) => handleChange('publicKey', e.target.value)}
              rows={2}
              className={textareaClasses}
              placeholder=""
            />
          </div>

          {/* Impressão Digital */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Impressão digital
            </label>
            <input
              type="text"
              value={formData.fingerprint}
              onChange={(e) => handleChange('fingerprint', e.target.value)}
              className={`${inputClasses} font-mono text-sm`}
              placeholder=""
            />
          </div>
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
              className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y"
              placeholder=""
            />
          </div>

          {/* Resolicitar senha mestre - Desativado temporariamente */}

          {/* Adicionar campo customizado */}
          <button
            type="button"
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Adicionar campo
          </button>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 disabled:opacity-50"
          disabled={isLoading || !formData.title}
        >
          {isLoading ? 'Salvando...' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

export default SSHKeyForm
