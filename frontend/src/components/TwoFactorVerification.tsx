import React, { useState } from 'react'
import { AlertCircle, Shield, Smartphone, X } from 'lucide-react'
import TwoFactorService from '../services/twoFactorService'

interface TwoFactorVerificationProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onUseBackupCode?: () => void
}

const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onUseBackupCode,
}) => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const canSubmit = useBackupCode ? code.trim().length >= 6 : code.length === 6

  const handleCodeChange = (value: string) => {
    if (useBackupCode) {
      setCode(value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32))
      return
    }

    setCode(value.replace(/\D/g, '').slice(0, 6))
  }

  const handleToggleCodeMode = () => {
    setUseBackupCode((currentMode) => !currentMode)
    setCode('')
    setError('')
    onUseBackupCode?.()
  }

  const handleVerification = async () => {
    if (!canSubmit) return

    setError('')
    setLoading(true)

    try {
      const result = await TwoFactorService.verifyCode(code.trim())

      if (result.verified) {
        onSuccess()
      } else {
        setAttempts(prev => prev + 1)
        setError(
          attempts >= 2
            ? 'Codigo invalido. Apos 3 tentativas erradas, tente um codigo de backup.'
            : useBackupCode
              ? 'Codigo de backup invalido. Verifique e tente novamente.'
              : 'Codigo invalido. Verifique e tente novamente.',
        )
        setCode('')
      }
    } catch (caughtError: any) {
      setError(caughtError.message || 'Erro ao verificar o codigo')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && canSubmit) {
      void handleVerification()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-200 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center text-xl font-bold text-gray-900 dark:text-dark-900">
            <Shield className="mr-2 h-6 w-6 text-primary-600" />
            Verificacao em 2 Fatores
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 transition-colors"
            disabled={loading}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 text-center">
          <Smartphone className="mx-auto mb-3 h-12 w-12 text-primary-600" />
          <p className="text-sm text-gray-600 dark:text-dark-700">
            {useBackupCode
              ? 'Digite um dos seus codigos de backup para concluir o acesso.'
              : 'Digite o codigo de 6 digitos do seu aplicativo autenticador.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-red-700 dark:text-red-300">
            <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            value={code}
            onChange={event => handleCodeChange(event.target.value)}
            onKeyPress={handleKeyPress}
            className={`w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-4 py-3 font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 ${useBackupCode ? 'text-center text-lg' : 'text-center text-2xl'}`}
            placeholder={useBackupCode ? 'CODIGO-BACKUP' : '000000'}
            maxLength={useBackupCode ? 32 : 6}
            disabled={loading}
            autoFocus
          />
        </div>

        <button
          onClick={() => void handleVerification()}
          className="mb-3 w-full rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !canSubmit}
          type="button"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              Verificando...
            </span>
          ) : (
            useBackupCode ? 'Verificar codigo de backup' : 'Verificar'
          )}
        </button>

        <button
          onClick={handleToggleCodeMode}
          className="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          disabled={loading}
          type="button"
        >
          {useBackupCode ? 'Usar codigo do aplicativo' : 'Usar codigo de backup'}
        </button>

        {attempts >= 3 && (
          <div className="mt-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Muitas tentativas falhadas.</strong> Se voce perdeu acesso ao seu app autenticador,
              use um codigo de backup ou entre em contato com o suporte.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TwoFactorVerification
