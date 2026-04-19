import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { Mail, Shield, ArrowLeft } from 'lucide-react'

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Obter a URL base da aplicação
      const resetUrl = `${window.location.origin}/auth/callback`
      
      console.log('Enviando email de recuperação para:', email)
      console.log('URL de redirecionamento:', resetUrl)
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      })

      console.log('Resposta do Supabase:', { data, error })

      if (error) {
        // Tratamento específico de erros
        if (error.message.includes('rate limit')) {
          throw new Error('Limite de emails atingido. Tente novamente em alguns minutos.')
        }
        if (error.message.includes('not found')) {
          throw new Error('Email não cadastrado no sistema.')
        }
        throw error
      }

      setSuccess(true)
      setEmail('')
    } catch (err: any) {
      console.error('Error completo:', err)
      setError(err.message || 'Erro ao enviar email de redefinição')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-secondary-900">
            Esqueceu sua senha?
          </h2>
          <p className="mt-2 text-sm text-secondary-600">
            Não se preocupe! Digite seu email e enviaremos instruções.
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          {success ? (
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                Email enviado!
              </h3>
              <p className="text-sm text-secondary-600 mb-4">
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <strong>Importante:</strong>
                </p>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Verifique também a pasta de <strong>Spam/Lixo Eletrônico</strong></li>
                  <li>• O email pode demorar alguns minutos para chegar</li>
                  <li>• Você pode enviar apenas 3 emails por hora</li>
                  <li>• O link é válido por apenas 1 hora</li>
                </ul>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center text-primary-600 hover:text-primary-500 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email cadastrado
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex justify-center py-3 text-base"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </div>
                  ) : (
                    'Enviar instruções'
                  )}
                </button>
              </div>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword 