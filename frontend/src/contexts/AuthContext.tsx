import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'
import { User, AuthContextType } from '../types'
import CryptoService from '../services/cryptoService'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          previousUserIdRef.current = session.user.id
          setUser({
            id: session.user.id,
            email: session.user.email!,
            fullName: session.user.user_metadata?.full_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
            lastLoginAt: session.user.last_sign_in_at,
          })
        }
      } catch (error) {
        console.error('Erro ao obter sessao inicial:', error)
      }
      setLoading(false)
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          const previousUserId = previousUserIdRef.current
          const newUserId = session.user.id

          if (previousUserId && previousUserId !== newUserId) {
            CryptoService.clearStoredKey(previousUserId)
          }

          previousUserIdRef.current = newUserId
          setUser({
            id: session.user.id,
            email: session.user.email!,
            fullName: session.user.user_metadata?.full_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
            lastLoginAt: session.user.last_sign_in_at,
          })
        } else {
          setUser(null)
          if (event === 'SIGNED_OUT') {
            previousUserIdRef.current = null
            CryptoService.clearStoredKey()
          }
        }
        setLoading(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const siteUrl = window.location.origin
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    CryptoService.clearAllKeys()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateProfile = async (updates: Partial<User>) => {
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: updates.fullName,
        avatar_url: updates.avatarUrl,
      },
    })
    if (error) throw error
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
