import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Lock, Mail, Eye, EyeOff, Shield, User, Check, RefreshCw } from 'lucide-react'

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const { signUp, resendConfirmationEmail } = useAuth()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
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

  const passwordValidation = validatePassword(formData.password)

  React.useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!passwordValidation.isValid) {
      setError('A senha nao atende aos criterios de seguranca')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas nao coincidem')
      setLoading(false)
      return
    }

    try {
      const normalizedEmail = formData.email.trim()
      await signUp(normalizedEmail, formData.password, formData.fullName)
      setRegisteredEmail(normalizedEmail)
      setSuccess('Conta criada com sucesso! Enviamos um email de confirmacao para voce.')
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!registeredEmail || resendLoading || resendCooldown > 0) {
      return
    }

    setResendLoading(true)
    setResendError('')
    setResendMessage('')

    try {
      await resendConfirmationEmail(registeredEmail)
      setResendMessage('Se este email ainda nao tiver sido confirmado, enviamos um novo link de confirmacao.')
      setResendCooldown(60)
    } catch (err: any) {
      setResendError(err.message || 'Nao foi possivel reenviar o email agora.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-secondary-900 dark:text-dark-900">
            Criar Conta
          </h2>
          <p className="mt-2 text-sm text-secondary-600 dark:text-dark-700">
            Junte-se ao SafeBox e proteja suas credenciais
          </p>
        </div>

        <div className="card p-8">
          {registeredEmail ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-green-600" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-secondary-900 dark:text-dark-900">
                  Conta criada
                </h3>
                <p className="text-sm text-secondary-600 dark:text-dark-700">
                  {success}
                </p>
                <p className="text-sm font-medium text-secondary-900 dark:text-dark-900 break-all">
                  {registeredEmail}
                </p>
              </div>

              {resendError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-left">
                  {resendError}
                </div>
              )}

              {resendMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-left">
                  {resendMessage}
                </div>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-left">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Dica:</strong> confira tambem as pastas de spam, promocoes e lixo eletronico.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading || resendCooldown > 0}
                className="btn-primary w-full flex justify-center items-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Reenviando...
                  </>
                ) : resendCooldown > 0 ? (
                  `Reenviar email em ${resendCooldown}s`
                ) : (
                  'Reenviar email de confirmacao'
                )}
              </button>

              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full border border-secondary-200 dark:border-dark-300 rounded-lg py-3 px-4 text-sm font-medium text-secondary-700 dark:text-dark-700 hover:bg-secondary-50 dark:hover:bg-dark-200"
              >
                Voltar para login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="fullName" className="form-label">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-secondary-400" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    className="input-field pl-10"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-secondary-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input-field pl-10"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-secondary-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="input-field pl-10 pr-10"
                    placeholder="Crie uma senha forte"
                    value={formData.password}
                    onChange={handleChange}
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

                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-secondary-600 dark:text-dark-700">CritÃ©rios de senha:</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                        <Check className={`h-3 w-3 mr-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`} />
                        12+ caracteres
                      </div>
                      <div className={`flex items-center ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`}>
                        <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`} />
                        MaiÃºscula
                      </div>
                      <div className={`flex items-center ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`}>
                        <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`} />
                        MinÃºscula
                      </div>
                      <div className={`flex items-center ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                        <Check className={`h-3 w-3 mr-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`} />
                        NÃºmero
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
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-secondary-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="input-field pl-10 pr-10"
                    placeholder="Confirme sua senha"
                    value={formData.confirmPassword}
                    onChange={handleChange}
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
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="form-error">As senhas nao coincidem</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !passwordValidation.isValid}
                  className="btn-primary w-full flex justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Criando conta...
                    </div>
                  ) : (
                    'Criar Conta'
                  )}
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-secondary-600 dark:text-dark-700">
                  Ja tem uma conta?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    Faca login
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-secondary-500 dark:text-dark-600">
            Criptografia zero-knowledge e seus dados 100% privados
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
