# Agent 2: React/Vite Specialist

## Responsabilidades Principais

- **Configuração e Otimização do Vite**: Setup inicial, configuração de build, plugins, otimizações
- **Arquitetura de Componentes React**: Estrutura de componentes, custom hooks, patterns
- **Gerenciamento de Estado Local**: useState, useEffect, useReducer para estados componente-específicos
- **Roteamento**: React Router para navegação, proteção de rotas
- **Performance**: Code splitting, lazy loading, otimizações de renderização
- **TypeScript Integration**: Tipos, interfaces, configurações
- **Development Experience**: Hot reload, debugging, dev tools

## Configuração do Vite

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@stores': path.resolve(__dirname, './src/stores'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
          crypto: ['argon2-browser'],
        },
      },
    },
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
})
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"],
      "@stores/*": ["./src/stores/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Estrutura de Componentes

### App Component

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Layout } from '@/components/layout/Layout'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { LoginPage } from '@/pages/LoginPage'
import { VaultPage } from '@/pages/VaultPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/vault" replace /> : <LoginPage />
          } 
        />
        
        <Route path="/" element={<AuthGuard />}>
          <Route path="/" element={<Navigate to="/vault" replace />} />
          <Route 
            path="/vault" 
            element={
              <Layout>
                <VaultPage />
              </Layout>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <Layout>
                <SettingsPage />
              </Layout>
            } 
          />
        </Route>
        
        <Route path="*" element={<Navigate to="/vault" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Auth Guard

```typescript
// src/components/auth/AuthGuard.tsx
import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function AuthGuard() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
```

## Custom Hooks

### useAsyncOperation

```typescript
// src/hooks/useAsyncOperation.ts
import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useAsyncOperation<T, P extends any[]>(
  asyncFunction: (...args: P) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (...args: P) => {
    setState({ data: null, loading: true, error: null })
    
    try {
      const result = await asyncFunction(...args)
      setState({ data: result, loading: false, error: null })
      return result
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      setState({ data: null, loading: false, error: errorObj })
      throw errorObj
    }
  }, [asyncFunction])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}
```

### useDebounce

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

## Performance Optimization

### Code Splitting

```typescript
// src/pages/index.ts
import { lazy } from 'react'

export const LoginPage = lazy(() =>
  import('./LoginPage').then(module => ({ default: module.LoginPage }))
)

export const VaultPage = lazy(() =>
  import('./VaultPage').then(module => ({ default: module.VaultPage }))
)

export const SettingsPage = lazy(() =>
  import('./SettingsPage').then(module => ({ default: module.SettingsPage }))
)
```

### Memoization

```typescript
// src/components/vault/CredentialsList.tsx
import { memo, useMemo } from 'react'

interface CredentialsListProps {
  credentials: Credential[]
  searchTerm: string
  onSelect: (credential: Credential) => void
}

export const CredentialsList = memo(function CredentialsList({
  credentials,
  searchTerm,
  onSelect
}: CredentialsListProps) {
  const filteredCredentials = useMemo(() => {
    if (!searchTerm) return credentials
    
    return credentials.filter(credential =>
      credential.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credential.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [credentials, searchTerm])

  return (
    <div className="space-y-2">
      {filteredCredentials.map(credential => (
        <CredentialItem
          key={credential.id}
          credential={credential}
          onClick={() => onSelect(credential)}
        />
      ))}
    </div>
  )
})
```

## Error Boundaries

```typescript
// src/components/ui/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <h2 className="text-lg font-semibold text-red-600 mb-2">
            Oops! Algo deu errado
          </h2>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Checklist de Responsabilidades

### Configuração ✅
- [ ] Vite config com aliases e otimizações
- [ ] TypeScript setup com paths mapping
- [ ] ESLint e Prettier configurados
- [ ] Estrutura de diretórios padronizada

### Componentes ✅
- [ ] Sistema de componentes base
- [ ] Componentes de formulário com validação
- [ ] Componentes de layout responsivos
- [ ] Error boundaries implementados

### Performance ✅
- [ ] Code splitting configurado
- [ ] Lazy loading de páginas
- [ ] Memoização onde necessário
- [ ] Otimizações de renderização

### Desenvolvimento ✅
- [ ] Custom hooks para lógica reutilizável
- [ ] Padrões TypeScript consistentes
- [ ] Hot reload funcionando
- [ ] Debugging tools configurados 