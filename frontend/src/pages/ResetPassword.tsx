import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { Lock, Shield, Eye, EyeOff, Check } from 'lucide-react'

const GENERIC_RESET_ERROR = 'Link inválido ou expirado. Solicite um novo link de redefinição.'

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Processar token da URL se existir
    handleAuthCallback()
  }, [])

  const handleAuthCallback = async () => {
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')
      
      if (type === 'recovery' && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: accessToken,
        })
        
        if (error) {
          throw error
        }
        
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError(GENERIC_RESET_ERROR)
        }
      }
    } catch {
      setError(GENERIC_RESET_ERROR)
    }
  }

  const validatePassword = (password: string) => {
    const minLength = password.length >= 12
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial
    }
  }

  const passwordValidation = validatePassword(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!passwordValidation.isValid) {
      setError('A senha não atende aos critérios de segurança')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      
      await supabase.auth.signOut()
      
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="card p-8 text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-secondary-900 dark:text-dark-900 mb-2">
              Senha redefinida com sucesso!
            </h2>
            <p className="text-secondary-600 dark:text-dark-700 mb-4">
              Você será redirecionado para a tela de login...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-secondary-900 dark:text-dark-900">
            Redefinir Senha
          </h2>
          <p className="mt-2 text-sm text-secondary-600 dark:text-dark-700">
            Crie uma nova senha segura para sua conta
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
              </div>
              
              {/* Password Requirements */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-secondary-600 dark:text-dark-700">Critérios de senha:</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className={`flex items-center ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                      <Check className={`h-3 w-3 mr-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`} />
                      12+ caracteres
                    </div>
                    <div className={`flex items-center ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`}>
                      <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`} />
                      Maiúscula
                    </div>
                    <div className={`flex items-center ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`}>
                      <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`} />
                      Minúscula
                    </div>
                    <div className={`flex items-center ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                      <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`} />
                      Número
                    </div>
                    <div className={`flex items-center col-span-2 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-red-600'}`}>
                      <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-red-600'}`} />
                      Caractere especial
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="form-error">As senhas não coincidem</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !passwordValidation.isValid || password !== confirmPassword}
                className="btn-primary w-full flex justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Redefinindo...
                  </div>
                ) : (
                  'Redefinir Senha'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword 
