import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { config } from './environment'
import { logger } from '@/utils/logger'
import { AppError } from '@/security/errors'

// Create Supabase client with service role key for backend operations
export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'safebox-backend',
      },
    },
  }
)

// Create admin client for administrative operations
export const supabaseAdmin = createClient<Database>(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  }
)

export const createSupabaseAuthClient = () => createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  },
)

export const createSupabaseUserClient = (accessToken: string) => createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Client-Info': 'safebox-backend-user-scoped',
      },
    },
  },
)

// Database connection test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('credentials')
      .select('id')
      .limit(1)

    if (error && error.code !== 'PGRST116') {
      logger.error('Database connection test failed:', error)
      return false
    }

    logger.info('Database connection successful')
    return true
  } catch (error) {
    logger.error('Database connection error:', error)
    return false
  }
}

// Database health check
export async function getDatabaseHealth() {
  try {
    const startTime = Date.now()
    
    const { error } = await supabase
      .from('credentials')
      .select('id')
      .limit(1)

    const responseTime = Date.now() - startTime

    if (error && error.code !== 'PGRST116') {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime,
      }
    }

    return {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}

// Utility function to execute raw SQL queries
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<{ data: T[] | null; error: any }> {
  try {
    void query
    void params
    throw new AppError('Raw SQL execution is disabled for safety', 403, 'RAW_SQL_DISABLED', {
      expose: true,
    })
  } catch (error) {
    logger.error('Query execution error:', error)
    return { data: null, error }
  }
}

// Transaction wrapper
export async function withTransaction<T>(
  callback: (_client: typeof supabase) => Promise<T>
): Promise<T> {
  // Note: Supabase doesn't support explicit transactions in the client
  // This is a placeholder for future implementation or custom transaction logic
  return await callback(supabase)
}

export default supabase 
