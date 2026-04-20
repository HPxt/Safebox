import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff, Shield, CheckCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import TwoFactorService from '../services/twoFactorService'
import TwoFactorVerification from '../components/TwoFactorVerification'
import { supabase } from '../config/supabase'

const authInputClasses = 'block w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 pl-10 text-gray-900 dark:text-gray-100 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:border-safebox-500 focus:outline-none focus:ring-2 focus:ring-safebox-500 sm:text-sm'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [show2FAVerification, setShow2FAVerification] = useState(false)
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const { signIn, resendConfirmationEmail } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('confirmed') === 'true') {
      setSuccess('Email confirmado com sucesso! Agora voce pode fazer login.')
    }

    const confirmationStatus = searchParams.get('confirmation')
    if (confirmationStatus === 'expired') {
      setError('Este link de confirmacao expirou ou ja nao e mais valido. Informe seu email para reenviar.')
      setShowResendConfirmation(true)
    } else if (confirmationStatus === 'invalid') {
      setError('Nao foi possivel validar este link de confirmacao. Tente reenviar um novo email.')
      setShowResendConfirmation(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await signIn(email, password)

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const has2FA = await TwoFactorService.check2FAStatus(user.id)
        if (has2FA) {
          setShow2FAVerification(true)
        } else {
          navigate('/dashboard')
        }
      }
    } catch (caughtError: any) {
      const message = caughtError.message || 'Erro ao fazer login'
      const normalizedMessage = String(message).toLowerCase()

      if (
        normalizedMessage.includes('email not confirmed') ||
        normalizedMessage.includes('email_not_confirmed') ||
        normalizedMessage.includes('confirm your email')
      ) {
        setError('Sua conta ainda nao foi confirmada. Reenvie o email de confirmacao para continuar.')
        setShowResendConfirmation(true)
      } else {
        setError(message)
        setShowResendConfirmation(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email.trim() || resendLoading || resendCooldown > 0) {
      return
    }

    setResendLoading(true)
    setError('')
    setSuccess('')

    try {
      await resendConfirmationEmail(email)
      setSuccess('Se este email estiver cadastrado e ainda nao confirmado, enviamos um novo link de confirmacao.')
      setShowResendConfirmation(true)
      setResendCooldown(60)
    } catch (caughtError: any) {
      setError(caughtError.message || 'Nao foi possivel reenviar o email de confirmacao.')
      setShowResendConfirmation(true)
    } finally {
      setResendLoading(false)
    }
  }

  const handle2FASuccess = () => {
    setShow2FAVerification(false)
    navigate('/dashboard')
  }

  const handle2FACancel = async () => {
    await supabase.auth.signOut()
    setShow2FAVerification(false)
    setError('Autenticacao de dois fatores e obrigatoria para acessar sua conta')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-dark-50 dark:to-dark-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-safebox-500">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-dark-900">SafeBox</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-dark-700">Entre na sua conta para acessar suas credenciais</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-dark-200 bg-white dark:bg-dark-100 p-8 shadow-lg dark:shadow-dark-200/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-green-700 dark:text-green-300">
                <CheckCircle className="mr-2 h-5 w-5" />
                {success}
              </div>
            )}

            {showResendConfirmation && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Nao recebeu o email ou o link expirou? Reenvie a confirmacao com o email informado abaixo.
                </p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={!email.trim() || resendLoading || resendCooldown > 0}
                  className="mt-3 inline-flex items-center text-sm font-medium text-safebox-600 hover:text-safebox-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Reenviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Reenviar confirmacao em ${resendCooldown}s`
                  ) : (
                    'Reenviar email de confirmacao'
                  )}
                </button>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-dark-700">
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={authInputClasses}
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-dark-700">
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-dark-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${authInputClasses} pr-10`}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 bg-white text-safebox-500 focus:ring-safebox-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-dark-900">
                  Lembrar de mim
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-safebox-500 hover:text-safebox-600"
                >
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg border border-transparent bg-safebox-500 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-safebox-600 focus:outline-none focus:ring-2 focus:ring-safebox-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                    Entrando...
                  </div>
                ) : (
                  'Entrar'
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-dark-700">
                Nao tem uma conta?{' '}
                <Link
                  to="/register"
                  className="font-medium text-safebox-500 hover:text-safebox-600"
                >
                  Cadastre-se
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-dark-600">
            Suas credenciais sao criptografadas com zero-knowledge
          </p>
        </div>
      </div>

      {show2FAVerification && (
        <TwoFactorVerification
          isOpen={show2FAVerification}
          onClose={handle2FACancel}
          onSuccess={handle2FASuccess}
        />
      )}
    </div>
  )
}

export default Login
