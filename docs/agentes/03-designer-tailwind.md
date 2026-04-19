# Agent 3: Tailwind CSS Designer

## Responsabilidades Principais

- **Design System**: Definição de tokens de design, cores, tipografia, espaçamentos
- **Componentes UI**: Estilização de componentes base, estados, variações
- **Layout Responsivo**: Breakpoints, grid systems, mobile-first approach
- **Acessibilidade**: Contraste, focus states, screen readers, ARIA
- **Animações**: Transições suaves, micro-interações, loading states
- **Temas**: Dark/light mode, customização visual
- **Performance CSS**: Otimização, purging, critical CSS

## Configuração do Tailwind

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

## Componentes Base

### Button Component

```typescript
// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500': variant === 'primary',
            'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700': variant === 'secondary',
            'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500': variant === 'danger',
            'hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-gray-500': variant === 'ghost',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
          },
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              className="opacity-75"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
```

### Input Component

```typescript
// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={props.id}>
            {label}
          </label>
        )}
        
        <div className="relative">
          <input
            type={inputType}
            className={cn(
              'block w-full rounded-md border-gray-300 shadow-sm',
              'focus:border-primary-500 focus:ring-primary-500',
              'disabled:bg-gray-50 disabled:text-gray-500',
              'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
              error && 'border-danger-300 focus:border-danger-500 focus:ring-danger-500',
              isPassword && 'pr-10',
              className
            )}
            ref={ref}
            {...props}
          />
          
          {isPassword && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          )}
        </div>
        
        {error && <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
```

### Card Component

```typescript
// src/components/ui/Card.tsx
import { cn } from '@/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-soft',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-b border-gray-200 dark:border-gray-700',
      className
    )}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
      className
    )}>
      {children}
    </div>
  )
}
```

## Layout Components

### Layout Principal

```typescript
// src/components/layout/Layout.tsx
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar para mobile */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isMobile={true}
      />
      
      {/* Sidebar para desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Conteúdo principal */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
```

### Sidebar Component

```typescript
// src/components/layout/Sidebar.tsx
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Link, useLocation } from 'react-router-dom'
import { KeyIcon, Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/authStore'

const navigation = [
  { name: 'Cofre', href: '/vault', icon: KeyIcon },
  { name: 'Configurações', href: '/settings', icon: Cog6ToothIcon },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  isMobile?: boolean
}

export function Sidebar({ isOpen, onClose, isMobile }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore(state => state.user)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-600">
        <KeyIcon className="h-8 w-8 text-white" />
        <span className="ml-2 text-xl font-bold text-white">SafeBox</span>
      </div>

      {/* Navigation */}
      <nav className="mt-5 flex-1 px-2 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
              )}
              onClick={onClose}
            >
              <item.icon className="mr-3 h-6 w-6" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.email?.[0]?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Mobile sidebar
  if (isMobile) {
    return (
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={onClose!}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 flex z-40">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={onClose}
                    >
                      <XMarkIcon className="h-6 w-6 text-white" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    )
  }

  // Desktop sidebar
  return (
    <div className="flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <SidebarContent />
    </div>
  )
}
```

## Dark Mode Support

### Dark Mode Hook

```typescript
// src/hooks/useDarkMode.ts
import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode')
      if (stored) return JSON.parse(stored)
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(isDark))
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}
```

### Theme Toggle Component

```typescript
// src/components/ui/ThemeToggle.tsx
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Button } from './Button'

export function ThemeToggle() {
  const { isDark, toggle } = useDarkMode()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="relative"
    >
      <SunIcon className={cn(
        "h-5 w-5 transition-all",
        isDark ? "rotate-90 scale-0" : "rotate-0 scale-100"
      )} />
      <MoonIcon className={cn(
        "absolute h-5 w-5 transition-all",
        isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"
      )} />
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
```

## Componentes Específicos do SafeBox

### Password Strength Indicator

```typescript
// src/components/ui/PasswordStrength.tsx
import { useMemo } from 'react'
import { cn } from '@/utils/cn'

interface PasswordStrengthProps {
  password: string
  className?: string
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }
    
    let score = 0
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password),
    }
    
    score = Object.values(checks).filter(Boolean).length
    
    if (score < 2) return { score, label: 'Muito fraca', color: 'bg-red-500' }
    if (score < 3) return { score, label: 'Fraca', color: 'bg-orange-500' }
    if (score < 4) return { score, label: 'Média', color: 'bg-yellow-500' }
    if (score < 5) return { score, label: 'Forte', color: 'bg-green-500' }
    return { score, label: 'Muito forte', color: 'bg-green-600' }
  }, [password])

  if (!password) return null

  return (
    <div className={cn('mt-2', className)}>
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all duration-300', strength.color)}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-fit">
          {strength.label}
        </span>
      </div>
    </div>
  )
}
```

## CSS Global Styles

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    @apply w-2;
  }
  
  ::-webkit-scrollbar-track {
    @apply bg-gray-100 dark:bg-gray-800;
  }
  
  ::-webkit-scrollbar-thumb {
    @apply bg-gray-300 dark:bg-gray-600 rounded-md;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-400 dark:bg-gray-500;
  }
}

@layer components {
  .btn-base {
    @apply inline-flex items-center justify-center rounded-md font-medium 
           transition-colors focus-visible:outline-none focus-visible:ring-2 
           focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
  }
  
  .input-base {
    @apply block w-full rounded-md border-gray-300 shadow-sm 
           focus:border-primary-500 focus:ring-primary-500 
           disabled:bg-gray-50 disabled:text-gray-500 
           dark:bg-gray-800 dark:border-gray-600 dark:text-white;
  }
}

@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

## Checklist de Responsabilidades

### Design System ✅
- [ ] Configuração Tailwind com tokens customizados
- [ ] Paleta de cores acessível
- [ ] Tipografia escalável
- [ ] Espaçamentos consistentes

### Componentes ✅
- [ ] Sistema de componentes base completo
- [ ] Variantes e estados definidos
- [ ] Props TypeScript tipadas
- [ ] Acessibilidade implementada

### Layout ✅
- [ ] Layout responsivo mobile-first
- [ ] Sidebar com estados mobile/desktop
- [ ] Header com navegação
- [ ] Grid system flexível

### Tema ✅
- [ ] Dark/Light mode funcional
- [ ] Persistência de preferência
- [ ] Transições suaves entre temas
- [ ] Componentes adaptados aos temas

### Performance ✅
- [ ] CSS otimizado e purged
- [ ] Animações performáticas
- [ ] Estados de loading elegantes
- [ ] Micro-interações fluidas 