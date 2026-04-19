import React from 'react'
import { X, Key, CreditCard, FileText, Fingerprint, Terminal } from 'lucide-react'

interface TypeSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: 'credential' | 'card' | 'note' | 'identity' | 'ssh_key') => void
}

const types = [
  {
    id: 'credential' as const,
    name: 'Credencial',
    description: 'Login de site ou aplicativo',
    icon: Key,
    color: 'bg-blue-500',
    disabled: false,
  },
  {
    id: 'card' as const,
    name: 'Cartão',
    description: 'Cartão de crédito ou débito',
    icon: CreditCard,
    color: 'bg-green-500',
    disabled: false,
  },
  {
    id: 'note' as const,
    name: 'Anotação',
    description: 'Texto livre seguro',
    icon: FileText,
    color: 'bg-yellow-500',
    disabled: false,
  },
  {
    id: 'identity' as const,
    name: 'Identidade',
    description: 'Documentos pessoais',
    icon: Fingerprint,
    color: 'bg-purple-500',
    disabled: false,
  },
  {
    id: 'ssh_key' as const,
    name: 'Chave SSH',
    description: 'Chaves de acesso',
    icon: Terminal,
    color: 'bg-gray-600',
    disabled: false,
  },
]

const TypeSelectionModal: React.FC<TypeSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Novo Item
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Types Grid */}
        <div className="p-4 space-y-2">
          {types.map((type) => (
            <button
              key={type.id}
              onClick={() => !type.disabled && onSelect(type.id)}
              disabled={type.disabled}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
                type.disabled
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-zinc-700'
                  : 'border-gray-200 dark:border-zinc-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className={`p-3 rounded-lg ${type.color}`}>
                <type.icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {type.name}
                  {type.disabled && (
                    <span className="ml-2 text-xs text-gray-400">(Em breve)</span>
                  )}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {type.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default TypeSelectionModal
