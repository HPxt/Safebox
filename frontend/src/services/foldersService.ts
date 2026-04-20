import { supabase } from '../config/supabase'
import { Folder } from '../types'

interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
}

class FoldersService {
  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    return user
  }

  async getFolders(): Promise<Folder[]> {
    try {
      const user = await this.getCurrentUser()
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      if (error) {
        throw error
      }

      return data || []
    } catch {
      return []
    }
  }

  async createFolder(folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const user = await this.getCurrentUser()
    
    const { data, error } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name: folderData.name,
        color: folderData.color,
        icon: folderData.icon,
        parent_id: folderData.parentId || null,
        position: folderData.position
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .update({
        name: updates.name,
        color: updates.color,
        icon: updates.icon,
        parent_id: updates.parentId,
        position: updates.position
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async deleteFolder(id: string): Promise<void> {
    // Verificar se há credenciais na pasta
    await this.getCurrentUser()
    
    // Para este exemplo, vamos permitir deletar mesmo com credenciais
    // Em produção, você pode querer implementar lógica de verificação
    
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error('Erro ao excluir pasta')
    }
  }

  async moveFolder(folderId: string, newParentId?: string, newPosition?: number): Promise<void> {
    const updates: any = {}
    
    if (newParentId !== undefined) {
      updates.parent_id = newParentId
    }
    
    if (newPosition !== undefined) {
      updates.position = newPosition
    }

    const { error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', folderId)

    if (error) {
      throw error
    }
  }

  buildFolderTree(folders: Folder[]): FolderWithChildren[] {
    const folderMap = new Map<string, FolderWithChildren>()
    const rootFolders: FolderWithChildren[] = []

    // Converter folders para FolderWithChildren
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] })
    })

    // Construir árvore
    folders.forEach(folder => {
      const folderWithChildren = folderMap.get(folder.id)!
      
      if (folder.parentId && folderMap.has(folder.parentId)) {
        const parent = folderMap.get(folder.parentId)!
        parent.children.push(folderWithChildren)
      } else {
        rootFolders.push(folderWithChildren)
      }
    })

    // Ordenar cada nível por posição
    const sortFolders = (folders: FolderWithChildren[]) => {
      folders.sort((a, b) => a.position - b.position)
      folders.forEach(folder => {
        if (folder.children.length > 0) {
          sortFolders(folder.children)
        }
      })
    }

    sortFolders(rootFolders)
    return rootFolders
  }
}

export const foldersService = new FoldersService() 
