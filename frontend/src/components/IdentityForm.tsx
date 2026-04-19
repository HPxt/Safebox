import React, { useState } from 'react'
import { Eye, EyeOff, Star, Plus } from 'lucide-react'

// Classes reutilizáveis para inputs que respeitam o tema
const inputClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
const selectClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
const textareaClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y"

interface IdentityFormData {
  title: string
  folderId: string | null
  // Detalhes pessoais
  personalTitle: string
  firstName: string
  middleName: string
  lastName: string
  username: string
  company: string
  // Identificação
  cpf: string
  passport: string
  licenseNumber: string
  // Extras
  notes: string
  requireMasterPassword: boolean
  isFavorite: boolean
}

interface Folder {
  id: string
  name: string
  color: string
}

interface IdentityFormProps {
  initialData?: Partial<IdentityFormData>
  folders: Folder[]
  onSubmit: (data: IdentityFormData) => void
  onCancel: () => void
  isLoading?: boolean
  isEditing?: boolean
}

const personalTitles = [
  { id: '', name: '-- Selecionar --' },
  { id: 'sr', name: 'Sr.' },
  { id: 'sra', name: 'Sra.' },
  { id: 'dr', name: 'Dr.' },
  { id: 'dra', name: 'Dra.' },
  { id: 'prof', name: 'Prof.' },
  { id: 'profa', name: 'Profa.' },
]

const IdentityForm: React.FC<IdentityFormProps> = ({
  initialData,
  folders,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<IdentityFormData>({
    title: initialData?.title || '',
    folderId: initialData?.folderId || null,
    personalTitle: initialData?.personalTitle || '',
    firstName: initialData?.firstName || '',
    middleName: initialData?.middleName || '',
    lastName: initialData?.lastName || '',
    username: initialData?.username || '',
    company: initialData?.company || '',
    cpf: initialData?.cpf || '',
    passport: initialData?.passport || '',
    licenseNumber: initialData?.licenseNumber || '',
    notes: initialData?.notes || '',
    requireMasterPassword: initialData?.requireMasterPassword || false,
    isFavorite: initialData?.isFavorite || false,
  })

  const [showCpf, setShowCpf] = useState(false)
  const [showPassport, setShowPassport] = useState(false)

  const handleChange = (field: keyof IdentityFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Formatar CPF: 000.000.000-00
  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value)
    if (formatted.replace(/\D/g, '').length <= 11) {
      handleChange('cpf', formatted)
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
              placeholder="Ex: Minha Identidade"
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

      {/* Detalhes Pessoais */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Detalhes pessoais
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Título
            </label>
            <select
              value={formData.personalTitle}
              onChange={(e) => handleChange('personalTitle', e.target.value)}
              className={selectClasses}
            >
              {personalTitles.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Primeiro nome */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Primeiro nome
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className={inputClasses}
              placeholder="Primeiro nome"
            />
          </div>

          {/* Nome do meio */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Nome do meio
            </label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) => handleChange('middleName', e.target.value)}
              className={inputClasses}
              placeholder="Nome do meio"
            />
          </div>

          {/* Sobrenome */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Sobrenome
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className={inputClasses}
              placeholder="Sobrenome"
            />
          </div>

          {/* Nome de usuário */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Nome de usuário
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              className={inputClasses}
              placeholder="Nome de usuário"
            />
          </div>

          {/* Empresa */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Empresa
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleChange('company', e.target.value)}
              className={inputClasses}
              placeholder="Empresa"
            />
          </div>
        </div>
      </div>

      {/* Identificação */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Identificação
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* CPF */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Número de CPF
            </label>
            <div className="relative">
              <input
                type={showCpf ? 'text' : 'password'}
                value={formData.cpf}
                onChange={handleCpfChange}
                className={`${inputClasses} pr-10 font-mono`}
                placeholder="000.000.000-00"
              />
              <button
                type="button"
                onClick={() => setShowCpf(!showCpf)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCpf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Passaporte */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Número do passaporte
            </label>
            <div className="relative">
              <input
                type={showPassport ? 'text' : 'password'}
                value={formData.passport}
                onChange={(e) => handleChange('passport', e.target.value.toUpperCase())}
                className={`${inputClasses} pr-10 font-mono uppercase`}
                placeholder="AB123456"
              />
              <button
                type="button"
                onClick={() => setShowPassport(!showPassport)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassport ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Licença */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Número da licença
            </label>
            <input
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => handleChange('licenseNumber', e.target.value)}
              className={inputClasses}
              placeholder="Número da CNH"
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
              className={textareaClasses}
              placeholder="Anotações adicionais..."
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

export default IdentityForm
