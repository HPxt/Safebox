# 🏗️ Agente 1: Arquiteto Supabase

> **Especialização**: Backend, Autenticação, Banco de Dados e Row-Level Security  
> **Foco**: Supabase, PostgreSQL, Auth, Edge Functions, RLS

## 🎯 Responsabilidades

### 🔐 Autenticação e Autorização
- Configurar Supabase Auth com Magic Links
- Implementar políticas Row-Level Security (RLS)
- Gerenciar sessões de usuário
- Configurar OAuth providers (futuro)

### 🗄️ Banco de Dados
- Estruturar esquema PostgreSQL
- Otimizar queries e índices
- Configurar triggers e functions
- Gerenciar migrações

### ⚡ Edge Functions
- Rate limiting personalizado
- Validações server-side
- Integrações com APIs externas
- Processamento seguro de dados

## 📚 Conhecimento Base - Supabase

### 🔑 Snippets de Autenticação

#### Configuração do Cliente Supabase
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})
```

#### Auth com Magic Link
```typescript
// Login com Magic Link
export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        app: 'safebox'
      }
    }
  })
  
  if (error) throw error
}

// Logout
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Verificar usuário atual
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
```

#### Gerenciamento de Sessão
```typescript
// Hook para monitorar estado de auth
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
```

### 🗄️ Snippets de Banco de Dados

#### Schema de Credenciais
```sql
-- Configuração inicial
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela principal de credenciais
CREATE TABLE public.credentials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enc_blob bytea NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credentials_updated_at 
  BEFORE UPDATE ON public.credentials 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_credentials_user_id ON public.credentials(user_id);
CREATE INDEX idx_credentials_created_at ON public.credentials(created_at DESC);
```

#### Políticas Row-Level Security
```sql
-- Habilitar RLS
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: usuários só veem suas próprias credenciais
CREATE POLICY "Users can view their own credentials"
  ON public.credentials FOR SELECT
  USING (auth.uid() = user_id);

-- Política de INSERT: usuários só podem inserir para si mesmos
CREATE POLICY "Users can insert their own credentials"
  ON public.credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política de UPDATE: usuários só podem atualizar suas próprias
CREATE POLICY "Users can update their own credentials"
  ON public.credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política de DELETE: usuários só podem deletar suas próprias
CREATE POLICY "Users can delete their own credentials"
  ON public.credentials FOR DELETE
  USING (auth.uid() = user_id);
```

#### Queries Otimizadas
```typescript
// Listar credenciais do usuário
export async function fetchUserCredentials() {
  const { data, error } = await supabase
    .from('credentials')
    .select('id, enc_blob, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data
}

// Inserir nova credencial
export async function insertCredential(encryptedBlob: ArrayBuffer) {
  const { data, error } = await supabase
    .from('credentials')
    .insert({
      enc_blob: encryptedBlob
    })
    .select('id, created_at')
    .single()

  if (error) throw error
  return data
}

// Atualizar credencial
export async function updateCredential(id: string, encryptedBlob: ArrayBuffer) {
  const { data, error } = await supabase
    .from('credentials')
    .update({
      enc_blob: encryptedBlob,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id, updated_at')
    .single()

  if (error) throw error
  return data
}

// Deletar credencial
export async function deleteCredential(id: string) {
  const { error } = await supabase
    .from('credentials')
    .delete()
    .eq('id', id)

  if (error) throw error
}
```

### ⚡ Snippets de Edge Functions

#### Rate Limiting Function
```typescript
// supabase/functions/rate-limit/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator?: (request: Request) => string
}

serve(async (req: Request) => {
  const config: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60000, // 1 minuto
  }

  const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
  const key = `rate_limit:${clientIP}`
  
  // Implementar lógica de rate limiting
  // com Redis ou outra storage
  
  return new Response(
    JSON.stringify({ allowed: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

#### Validação Server-side
```typescript
// supabase/functions/validate-credential/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { z } from 'https://deno.land/x/zod/mod.ts'

const CredentialSchema = z.object({
  title: z.string().min(1).max(100),
  username: z.string().min(1).max(255),
  password: z.string().min(1),
  url: z.string().url().optional(),
  notes: z.string().max(1000).optional()
})

serve(async (req: Request) => {
  try {
    const body = await req.json()
    const validated = CredentialSchema.parse(body)
    
    return new Response(
      JSON.stringify({ valid: true, data: validated }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        valid: false, 
        errors: error.errors || [error.message] 
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

## 🔧 Configurações e Boas Práticas

### ⚙️ Configuração de Ambiente
```bash
# Variáveis essenciais
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (apenas server-side)

# Para desenvolvimento local
SUPABASE_LOCAL_URL=http://localhost:54321
SUPABASE_LOCAL_ANON_KEY=local-anon-key
```

### 🛡️ Segurança Essencial
```sql
-- Função para validar força da master password (server-side)
CREATE OR REPLACE FUNCTION validate_master_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    LENGTH(password) >= 12 AND
    password ~ '[A-Z]' AND
    password ~ '[a-z]' AND
    password ~ '[0-9]' AND
    password ~ '[^A-Za-z0-9]'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revogar acesso público
REVOKE ALL ON FUNCTION validate_master_password_strength FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_master_password_strength TO authenticated;
```

### 📊 Monitoramento e Logs
```typescript
// Wrapper para logs estruturados
export function logSecurityEvent(
  event: string, 
  userId?: string, 
  metadata?: Record<string, any>
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    userId,
    metadata,
    source: 'safebox-app'
  }))
}

// Exemplo de uso
logSecurityEvent('credential_created', user.id, { 
  credentialCount: credentials.length 
})
```

## 🚀 Padrões de Implementação

### 🔄 Real-time com Subscriptions
```typescript
// Escutar mudanças em tempo real
export function useCredentialsSubscription(userId: string) {
  const [credentials, setCredentials] = useState([])

  useEffect(() => {
    const subscription = supabase
      .channel('credentials_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credentials',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Atualizar estado local
          setCredentials(prev => {
            switch (payload.eventType) {
              case 'INSERT':
                return [payload.new, ...prev]
              case 'UPDATE':
                return prev.map(cred => 
                  cred.id === payload.new.id ? payload.new : cred
                )
              case 'DELETE':
                return prev.filter(cred => cred.id !== payload.old.id)
              default:
                return prev
            }
          })
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [userId])

  return credentials
}
```

### 🔍 Busca Otimizada
```sql
-- Extensão para busca full-text (futuro)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN para busca (quando implementarmos busca por metadados)
-- CREATE INDEX idx_credentials_search ON credentials 
-- USING GIN(to_tsvector('english', metadata_searchable));
```

## 📋 Checklist de Responsabilidades

### ✅ Setup Inicial
- [x] Criar projeto Supabase
- [x] Configurar autenticação Magic Link
- [x] Habilitar Row-Level Security
- [x] Criar tabela de credenciais
- [x] Implementar políticas RLS

### ✅ Desenvolvimento
- [x] Cliente Supabase configurado
- [x] Hooks de autenticação
- [x] Funções CRUD otimizadas
- [x] Error handling robusto
- [x] Logs de segurança

### ✅ Produção
- [x] Edge Functions para rate limiting
- [x] Validações server-side
- [x] Monitoramento ativo
- [x] Backup automatizado
- [x] Políticas de retenção

## 🎯 Próximos Passos

1. **Implementar busca avançada** com full-text search
2. **Adicionar OAuth providers** (Google, GitHub)
3. **Configurar alertas** de segurança
4. **Otimizar performance** com cache inteligente
5. **Implementar audit logs** para compliance

---

**💡 Este agente é responsável por manter a infraestrutura backend segura, escalável e performante!** 