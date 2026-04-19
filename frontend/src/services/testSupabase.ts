import { supabase } from '../config/supabase'

export const testSupabaseAuth = async () => {
  console.log('🧪 Testando autenticação do Supabase...')
  
  try {
    // Verificar sessão atual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 Sessão atual:', {
      exists: !!session,
      user: session?.user?.email || 'Nenhum usuário',
      error: sessionError?.message || 'Nenhum erro'
    })
    
    // Verificar usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('👤 Usuário atual:', {
      exists: !!user,
      email: user?.email || 'Nenhum usuário',
      error: userError?.message || 'Nenhum erro'
    })
    
    return {
      session: !!session,
      user: !!user,
      sessionError,
      userError
    }
  } catch (error) {
    console.error('❌ Erro no teste de autenticação:', error)
    return {
      session: false,
      user: false,
      sessionError: error,
      userError: error
    }
  }
}

export const testSupabaseConnection = async () => {
  console.log('🔗 Testando conexão com Supabase...')
  
  try {
    // Teste simples de conexão
    const { data, error } = await supabase
      .from('credentials')
      .select('count(*)')
      .limit(1)
    
    console.log('✅ Conexão com Supabase:', {
      success: !error,
      error: error?.message || 'Nenhum erro'
    })
    
    return !error
  } catch (error) {
    console.error('❌ Erro na conexão com Supabase:', error)
    return false
  }
} 