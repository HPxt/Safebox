import React, { useState } from 'react'
import { Eye, EyeOff, Star, Plus } from 'lucide-react'

// Classes reutilizáveis para inputs que respeitam o tema
const inputClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
const selectClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
const textareaClasses = "w-full px-3 py-2 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y"

interface CardFormData {
  title: string
  folderId: string | null
  cardHolderName: string
  cardNumber: string
  cardBrand: string
  cardExpMonth: string
  cardExpYear: string
  cardCvv: string
  notes: string
  requireMasterPassword: boolean
  isFavorite: boolean
}

interface Folder {
  id: string
  name: string
  color: string
}

interface CardFormProps {
  initialData?: Partial<CardFormData>
  folders: Folder[]
  onSubmit: (data: CardFormData) => void
  onCancel: () => void
  isLoading?: boolean
  isEditing?: boolean
}

const cardBrands = [
  { id: '', name: '-- Selecione --' },
  { id: 'visa', name: 'Visa' },
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'amex', name: 'American Express' },
  { id: 'elo', name: 'Elo' },
  { id: 'hipercard', name: 'Hipercard' },
  { id: 'diners', name: 'Diners Club' },
  { id: 'discover', name: 'Discover' },
  { id: 'jcb', name: 'JCB' },
  { id: 'other', name: 'Outro' },
]

const months = [
  { id: '', name: '-- Selecione --' },
  { id: '01', name: '01 - Janeiro' },
  { id: '02', name: '02 - Fevereiro' },
  { id: '03', name: '03 - Março' },
  { id: '04', name: '04 - Abril' },
  { id: '05', name: '05 - Maio' },
  { id: '06', name: '06 - Junho' },
  { id: '07', name: '07 - Julho' },
  { id: '08', name: '08 - Agosto' },
  { id: '09', name: '09 - Setembro' },
  { id: '10', name: '10 - Outubro' },
  { id: '11', name: '11 - Novembro' },
  { id: '12', name: '12 - Dezembro' },
]

const CardForm: React.FC<CardFormProps> = ({
  initialData,
  folders,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<CardFormData>({
    title: initialData?.title || '',
    folderId: initialData?.folderId || null,
    cardHolderName: initialData?.cardHolderName || '',
    cardNumber: initialData?.cardNumber || '',
    cardBrand: initialData?.cardBrand || '',
    cardExpMonth: initialData?.cardExpMonth || '',
    cardExpYear: initialData?.cardExpYear || '',
    cardCvv: initialData?.cardCvv || '',
    notes: initialData?.notes || '',
    requireMasterPassword: initialData?.requireMasterPassword || false,
    isFavorite: initialData?.isFavorite || false,
  })

  const [showCardNumber, setShowCardNumber] = useState(false)
  const [showCvv, setShowCvv] = useState(false)

  const handleChange = (field: keyof CardFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Formatar número do cartão com espaços
  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    const groups = numbers.match(/.{1,4}/g)
    return groups ? groups.join(' ') : numbers
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value)
    if (formatted.replace(/\s/g, '').length <= 16) {
      handleChange('cardNumber', formatted)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  // Gerar anos (atual até +20)
  const currentYear = new Date().getFullYear()
  const years = [
    { id: '', name: '-- Ano --' },
    ...Array.from({ length: 21 }, (_, i) => ({
      id: String(currentYear + i),
      name: String(currentYear + i),
    })),
  ]

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
              placeholder="Ex: Cartão Nubank, Itaú, etc."
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

      {/* Detalhes do Cartão */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Detalhes do cartão
        </h3>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-4">
          {/* Nome do titular */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Nome do titular do cartão
            </label>
            <input
              type="text"
              value={formData.cardHolderName}
              onChange={(e) => handleChange('cardHolderName', e.target.value.toUpperCase())}
              className={`${inputClasses} uppercase`}
              placeholder="NOME COMO NO CARTÃO"
            />
          </div>

          {/* Número do cartão */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Número
            </label>
            <div className="relative">
              <input
                type={showCardNumber ? 'text' : 'password'}
                value={formData.cardNumber}
                onChange={handleCardNumberChange}
                className={`${inputClasses} pr-10 font-mono`}
                placeholder="0000 0000 0000 0000"
              />
              <button
                type="button"
                onClick={() => setShowCardNumber(!showCardNumber)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCardNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Bandeira */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Bandeira
            </label>
            <select
              value={formData.cardBrand}
              onChange={(e) => handleChange('cardBrand', e.target.value)}
              className={inputClasses}
            >
              {cardBrands.map(brand => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Validade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Mês de vencimento
              </label>
              <select
                value={formData.cardExpMonth}
                onChange={(e) => handleChange('cardExpMonth', e.target.value)}
                className={inputClasses}
              >
                {months.map(month => (
                  <option key={month.id} value={month.id}>
                    {month.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Ano de vencimento
              </label>
              <select
                value={formData.cardExpYear}
                onChange={(e) => handleChange('cardExpYear', e.target.value)}
                className={inputClasses}
              >
                {years.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CVV */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Código de segurança (CVV)
            </label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'}
                value={formData.cardCvv}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 4) {
                    handleChange('cardCvv', value)
                  }
                }}
                className={`${inputClasses} pr-10 font-mono`}
                placeholder="000"
                maxLength={4}
              />
              <button
                type="button"
                onClick={() => setShowCvv(!showCvv)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCvv ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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

export default CardForm
