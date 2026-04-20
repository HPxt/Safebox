import { supabase } from '../config/supabase'

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1'])

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '')
const isLocalhostUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return LOCALHOST_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export const getPublicAppUrl = (): string => {
  const configuredUrl = process.env.REACT_APP_PUBLIC_APP_URL?.trim()
  const runtimeOrigin = typeof window !== 'undefined' ? normalizeUrl(window.location.origin) : ''
  const runtimeIsLocalhost = typeof window !== 'undefined' && LOCALHOST_HOSTS.has(window.location.hostname)

  if (configuredUrl) {
    const normalizedConfiguredUrl = normalizeUrl(configuredUrl)

    if (!runtimeIsLocalhost && isLocalhostUrl(normalizedConfiguredUrl)) {
      if (runtimeOrigin) {
        return runtimeOrigin
      }
    } else {
      return normalizedConfiguredUrl
    }
  }

  if (runtimeOrigin) {
    return runtimeOrigin
  }

  throw new Error('A URL publica do app nao esta configurada. Defina REACT_APP_PUBLIC_APP_URL.')
}

export const getAuthCallbackUrl = (): string => `${getPublicAppUrl()}/auth/callback`

const mapSupabaseEmailError = (error: unknown, fallbackMessage: string): Error => {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const normalizedMessage = rawMessage.toLowerCase()

  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('security purposes')) {
    return new Error('Limite de envio atingido. Aguarde alguns minutos para tentar novamente.')
  }

  return new Error(fallbackMessage)
}

export const sendSignupConfirmation = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    throw new Error('Informe seu email para reenviar a confirmacao.')
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
    },
  })

  if (error) {
    throw mapSupabaseEmailError(
      error,
      'Nao foi possivel reenviar o email agora. Tente novamente em instantes.',
    )
  }
}

export const sendResetPassword = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    throw new Error('Informe um email valido para continuar.')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getAuthCallbackUrl(),
  })

  if (error) {
    throw mapSupabaseEmailError(
      error,
      'Erro ao enviar email de redefinicao. Tente novamente em alguns instantes.',
    )
  }
}
