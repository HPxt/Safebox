import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type ScopedClient = SupabaseClient<Database>

export class FolderRepository {
  constructor(private readonly scopedClient: ScopedClient) {}

  async listByUser(userId: string) {
    const { data, error } = await this.scopedClient
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    if (error) {
      throw error
    }

    return data ?? []
  }

  async create(userId: string, folder: {
    name: string
    color?: string
    icon?: string
    parentId?: string | null
    position?: number
  }) {
    const folderRow: Database['public']['Tables']['folders']['Insert'] = {
      user_id: userId,
      name: folder.name,
      icon: folder.icon ?? 'folder',
      parent_id: folder.parentId ?? null,
      position: folder.position ?? 0,
    }
    if (folder.color !== undefined) {
      folderRow.color = folder.color
    }

    const { data, error } = await this.scopedClient
      .from('folders')
      .insert(folderRow)
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return data
  }
}
