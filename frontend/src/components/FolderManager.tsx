import React, { useState, useEffect } from 'react'
import { Folder, FolderFormData } from '../types'
import { foldersService } from '../services/foldersService'
import { 
  Folder as FolderIcon, 
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronRight, 
  ChevronDown
} from 'lucide-react'

interface FolderManagerProps {
  selectedFolderId?: string
  onFolderSelect: (folderId: string | undefined) => void
  onFolderChange: () => void
}

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
}

const FOLDER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#175DDC', // blue (Bitwarden style)
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280'  // gray
]

const FOLDER_ICONS = [
  'folder',
  'briefcase',
  'home',
  'user',
  'heart',
  'star',
  'shield',
  'key',
  'settings',
  'globe'
]

const folderModalInputClasses = 'w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const folderModalSecondaryButtonClasses = 'px-4 py-2 text-gray-600 dark:text-dark-700 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-md transition-colors'

const FolderManager: React.FC<FolderManagerProps> = ({
  selectedFolderId,
  onFolderSelect,
  onFolderChange
}) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folderTree, setFolderTree] = useState<FolderWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [formData, setFormData] = useState<FolderFormData>({
    name: '',
    color: FOLDER_COLORS[0],
    icon: FOLDER_ICONS[0],
    parentId: undefined
  })

  useEffect(() => {
    loadFolders()
  }, [])

  useEffect(() => {
    const tree = foldersService.buildFolderTree(folders) as FolderWithChildren[]
    setFolderTree(tree)
  }, [folders])

  const loadFolders = async () => {
    try {
      setLoading(true)
      const folderData = await foldersService.getFolders()
      setFolders(folderData)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await foldersService.createFolder({
        userId: '', // Será preenchido pelo serviço
        name: formData.name,
        color: formData.color || FOLDER_COLORS[0],
        icon: formData.icon || FOLDER_ICONS[0],
        parentId: formData.parentId,
        position: 0
      })
      
      await loadFolders()
      onFolderChange()
      setShowCreateModal(false)
      resetForm()
    } catch {
      alert('Erro ao criar pasta')
    }
  }

  const handleEditFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFolder) return

    try {
      await foldersService.updateFolder(editingFolder.id, {
        name: formData.name,
        color: formData.color,
        icon: formData.icon,
        parentId: formData.parentId
      })
      
      await loadFolders()
      onFolderChange()
      setShowEditModal(false)
      setEditingFolder(null)
      resetForm()
    } catch {
      alert('Erro ao editar pasta')
    }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    if (!window.confirm(`Tem certeza que deseja excluir a pasta "${folder.name}"?`)) {
      return
    }

    try {
      await foldersService.deleteFolder(folder.id)
      await loadFolders()
      onFolderChange()
      
      // Se a pasta deletada estava selecionada, limpar seleção
      if (selectedFolderId === folder.id) {
        onFolderSelect(undefined)
      }
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir pasta')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      color: FOLDER_COLORS[0],
      icon: FOLDER_ICONS[0],
      parentId: undefined
    })
  }

  const openCreateModal = (parentId?: string) => {
    resetForm()
    setFormData(prev => ({ ...prev, parentId }))
    setShowCreateModal(true)
  }

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder)
    setFormData({
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      parentId: folder.parentId
    })
    setShowEditModal(true)
  }

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const renderFolder = (folder: FolderWithChildren, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const hasChildren = folder.children.length > 0

    return (
      <div key={folder.id} className="select-none">
        <div 
          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
            isSelected 
              ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800' 
              : 'border-transparent hover:bg-gray-100 text-gray-700 dark:text-dark-700 dark:hover:bg-dark-200'
          }`}
          style={{ marginLeft: `${level * 16}px` }}
        >
          <div 
            className="flex items-center flex-1"
            onClick={() => onFolderSelect(isSelected ? undefined : folder.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolderExpansion(folder.id)
                }}
                className="mr-1 p-1 hover:bg-gray-200 dark:hover:bg-dark-300 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
            
            <div 
              className="w-4 h-4 rounded mr-2 flex-shrink-0"
              style={{ backgroundColor: folder.color }}
            />
            
            {isSelected ? (
              <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0" />
            ) : (
              <FolderIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            )}
            
            <span className="text-sm font-medium truncate">
              {folder.name}
            </span>
          </div>
          
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditModal(folder)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-dark-300 rounded transition-colors"
              title="Editar pasta"
            >
              <Edit className="h-3 w-3" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                openCreateModal(folder.id)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-dark-300 rounded transition-colors"
              title="Criar subpasta"
            >
              <Plus className="h-3 w-3" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteFolder(folder)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-dark-300 rounded text-red-500 dark:text-red-400 transition-colors"
              title="Excluir pasta"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-dark-100 rounded-lg border border-gray-200 dark:border-dark-200">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-dark-300 rounded"></div>
          <div className="h-6 bg-gray-100 dark:bg-dark-200 rounded"></div>
          <div className="h-6 bg-gray-100 dark:bg-dark-200 rounded ml-4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-dark-100 rounded-lg shadow-sm dark:shadow-dark-200/20 border border-gray-200 dark:border-dark-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-dark-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900">Pastas</h3>
          <button
            onClick={() => openCreateModal()}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
            title="Nova pasta"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-1 flex-1 overflow-y-auto scrollbar-thin">
        {/* Opção "Todas as credenciais" */}
        <div 
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
            !selectedFolderId 
              ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800' 
              : 'hover:bg-gray-100 text-gray-700 dark:text-dark-700 dark:hover:bg-dark-200'
          }`}
          onClick={() => onFolderSelect(undefined)}
        >
          <FolderIcon className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Todas as credenciais</span>
        </div>
        
        {folderTree.map(folder => renderFolder(folder))}
        
        {folderTree.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-dark-600">
            <FolderIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhuma pasta criada</p>
            <button
              onClick={() => openCreateModal()}
              className="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
            >
              Criar primeira pasta
            </button>
          </div>
        )}
      </div>

      {/* Modal de Criar Pasta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-100 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-dark-200 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-900">Nova Pasta</h3>
            
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                  Nome da pasta
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={folderModalInputClasses}
                  placeholder="Ex: Trabalho, Pessoal..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-800 dark:border-dark-900' : 'border-gray-300 dark:border-dark-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                  className={folderModalSecondaryButtonClasses}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md"
                >
                  Criar Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Pasta */}
      {showEditModal && editingFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-100 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-dark-200 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-900">Editar Pasta</h3>
            
            <form onSubmit={handleEditFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                  Nome da pasta
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={folderModalInputClasses}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-800 dark:border-dark-900' : 'border-gray-300 dark:border-dark-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingFolder(null)
                    resetForm()
                  }}
                  className={folderModalSecondaryButtonClasses}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default FolderManager 
