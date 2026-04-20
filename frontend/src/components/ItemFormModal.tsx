import React, { useState } from 'react'
import { X, Key, CreditCard, FileText, Fingerprint, Terminal } from 'lucide-react'
import TypeSelectionModal from './TypeSelectionModal'
import CredentialForm from './CredentialForm'
import CardForm from './CardForm'
import NoteForm from './NoteForm'
import IdentityForm from './IdentityForm'
import SSHKeyForm from './SSHKeyForm'

type ItemType = 'credential' | 'card' | 'note' | 'identity' | 'ssh_key'

interface Folder {
  id: string
  name: string
  color: string
}

interface ItemFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (type: ItemType, data: any) => Promise<void>
  folders: Folder[]
  onGeneratePassword: () => void
  editingItem?: {
    type: ItemType
    data: any
  }
}

const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  folders,
  onGeneratePassword,
  editingItem,
}) => {
  const [selectedType, setSelectedType] = useState<ItemType | null>(
    editingItem?.type || null
  )
  const [isLoading, setIsLoading] = useState(false)

  const handleTypeSelect = (type: ItemType) => {
    setSelectedType(type)
  }

  const handleBack = () => {
    if (!editingItem) {
      setSelectedType(null)
    }
  }

  const handleClose = () => {
    setSelectedType(editingItem?.type || null)
    onClose()
  }

  const handleSubmit = async (data: any) => {
    if (!selectedType) return
    
    setIsLoading(true)
    try {
      await onSave(selectedType, data)
      handleClose()
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  // Se não selecionou tipo ainda, mostra seleção
  if (!selectedType) {
    return (
      <TypeSelectionModal
        isOpen={true}
        onClose={handleClose}
        onSelect={handleTypeSelect}
      />
    )
  }

  // Título e ícone baseado no tipo
  const typeConfig = {
    credential: { title: 'Nova credencial', icon: Key, color: 'text-blue-500' },
    card: { title: 'Novo cartão', icon: CreditCard, color: 'text-green-500' },
    note: { title: 'Nova anotação', icon: FileText, color: 'text-yellow-500' },
    identity: { title: 'Nova identidade', icon: Fingerprint, color: 'text-purple-500' },
    ssh_key: { title: 'Nova chave SSH', icon: Terminal, color: 'text-gray-500' },
  }

  const config = typeConfig[selectedType]
  const Icon = config.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg mx-4 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            {!editingItem && (
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ←
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              {editingItem ? `Editar ${selectedType === 'credential' ? 'credencial' : 'cartão'}` : config.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {selectedType === 'credential' && (
            <CredentialForm
              initialData={editingItem?.data}
              folders={folders}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              onGeneratePassword={onGeneratePassword}
              isLoading={isLoading}
              isEditing={!!editingItem}
            />
          )}

          {selectedType === 'card' && (
            <CardForm
              initialData={editingItem?.data}
              folders={folders}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isLoading={isLoading}
              isEditing={!!editingItem}
            />
          )}

          {selectedType === 'note' && (
            <NoteForm
              initialData={editingItem?.data}
              folders={folders}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isLoading={isLoading}
              isEditing={!!editingItem}
            />
          )}

          {selectedType === 'identity' && (
            <IdentityForm
              initialData={editingItem?.data}
              folders={folders}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isLoading={isLoading}
              isEditing={!!editingItem}
            />
          )}

          {selectedType === 'ssh_key' && (
            <SSHKeyForm
              initialData={editingItem?.data}
              folders={folders}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isLoading={isLoading}
              isEditing={!!editingItem}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ItemFormModal
