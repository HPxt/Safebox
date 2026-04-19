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
    const { data, error } = await this.scopedClient
      .from('folders')
      .insert({
        user_id: userId,
        name: folder.name,
        color: folder.color,
        icon: folder.icon ?? 'folder',
        parent_id: folder.parentId ?? null,
        position: folder.position ?? 0,
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return data
  }
}
