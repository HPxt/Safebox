import React, { useState } from 'react'
import { X, Lock, Eye, EyeOff } from 'lucide-react'
import CryptoService from '../services/cryptoService'

interface MasterPasswordPromptProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  credentialTitle?: string
}

const MasterPasswordPrompt: React.FC<MasterPasswordPromptProps> = ({
  isOpen,
  onClose,
  onSuccess,
  credentialTitle,
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Verificar se a senha está correta usando o CryptoService
      const isValid = await CryptoService.verifyMasterPassword(password)
      
      if (isValid) {
        setPassword('')
        onSuccess()
      } else {
        setError('Senha incorreta')
      }
    } catch {
      setError('Erro ao verificar senha')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Verificação Necessária
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {credentialTitle ? (
              <>A credencial <strong className="text-gray-900 dark:text-white">"{credentialTitle}"</strong> requer sua senha mestre para ser acessada.</>
            ) : (
              <>Esta credencial requer sua senha mestre para ser acessada.</>
            )}
          </p>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Senha Mestre
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                placeholder="Digite sua senha mestre"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              disabled={loading || !password}
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MasterPasswordPrompt
