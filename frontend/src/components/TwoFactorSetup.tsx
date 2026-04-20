import React, { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Shield, Smartphone, Copy, Check, X, AlertCircle } from 'lucide-react'
import TwoFactorService from '../services/twoFactorService'
import { useAuth } from '../contexts/AuthContext'

interface TwoFactorSetupProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secret, setSecret] = useState('')
  const [qrUri, setQrUri] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  React.useEffect(() => {
    if (!isOpen || step !== 1 || !user?.email) {
      return
    }

    const { secret: generatedSecret, uri } = TwoFactorService.generateSecret(user.email)
    const generatedCodes = TwoFactorService.generateBackupCodes()

    setSecret(generatedSecret)
    setQrUri(uri)
    setBackupCodes(generatedCodes)
  }, [isOpen, step, user?.email])

  const copyToClipboard = async (text: string, type: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'secret') {
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
      } else {
        setCopiedCodes(true)
        setTimeout(() => setCopiedCodes(false), 2000)
      }
    } catch {
    }
  }

  const handleVerification = async () => {
    if (!user || verificationCode.length !== 6) return

    setError('')
    setLoading(true)

    try {
      const isValid = TwoFactorService.verifyToken(secret, verificationCode)

      if (!isValid) {
        setError('Codigo invalido. Verifique e tente novamente.')
        return
      }

      await TwoFactorService.enable2FA(secret, backupCodes, verificationCode)
      onSuccess()
      handleClose()
    } catch (caughtError: any) {
      setError(caughtError.message || 'Erro ao ativar 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSecret('')
    setQrUri('')
    setBackupCodes([])
    setVerificationCode('')
    setError('')
    setCopiedSecret(false)
    setCopiedCodes(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-dark-100 border border-gray-200 dark:border-dark-200 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center text-xl font-bold text-gray-900 dark:text-dark-900">
            <Shield className="mr-2 h-6 w-6 text-primary-600" />
            Configurar Autenticacao em 2 Fatores
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 transition-colors"
            disabled={loading}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <Smartphone className="mx-auto mb-3 h-12 w-12 text-primary-600" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-dark-900">Passo 1: Configure seu aplicativo</h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-dark-700">
                Escaneie o QR Code com seu app autenticador (Google Authenticator, Authy, etc).
              </p>
            </div>

            <div className="flex justify-center rounded-lg bg-gray-50 dark:bg-dark-200 p-4">
              {qrUri && (
                <QRCodeCanvas
                  value={qrUri}
                  size={200}
                  level="M"
                  includeMargin
                />
              )}
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-primary-900/20 p-3">
              <p className="mb-2 text-xs text-blue-800 dark:text-blue-200">Nao consegue escanear? Digite manualmente:</p>
              <div className="flex items-center justify-between rounded border border-blue-200 dark:border-primary-800 bg-white dark:bg-dark-100 p-2">
                <code className="text-xs break-all text-gray-900 dark:text-dark-900">{secret}</code>
                <button
                  onClick={() => copyToClipboard(secret, 'secret')}
                  className="ml-2 rounded p-1 hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
                  type="button"
                >
                  {copiedSecret ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-600 dark:text-dark-700" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              type="button"
            >
              Proximo: Salvar codigos de backup
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-yellow-600" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-dark-900">Passo 2: Salve seus codigos de backup</h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-dark-700">
                Guarde estes codigos em um local seguro. Voce pode usar cada codigo uma vez se perder
                acesso ao seu app.
              </p>
            </div>

            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
              <div className="mb-3 grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="rounded bg-white dark:bg-dark-100 p-2 text-center font-mono text-sm text-gray-900 dark:text-dark-900">
                    {code}
                  </div>
                ))}
              </div>
              <button
                onClick={() => copyToClipboard(backupCodes.join('\n'), 'codes')}
                className="flex w-full items-center justify-center text-sm text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
                type="button"
              >
                {copiedCodes ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copiar todos os codigos
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-xs text-red-800 dark:text-red-200">
                <strong>Importante:</strong> Apos fechar esta tela, voce nao podera ver estes codigos novamente.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-dark-300 px-4 py-2 text-gray-700 dark:text-dark-700 hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
                type="button"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
                type="button"
              >
                Proximo: Verificar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-dark-900">Passo 3: Verificar configuracao</h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-dark-700">
                Digite o codigo de 6 digitos do seu app para confirmar.
              </p>
            </div>

            {error && (
              <div className="flex items-start rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-red-700 dark:text-red-300">
                <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-dark-700">Codigo de verificacao</label>
              <input
                type="text"
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-4 py-3 text-center text-2xl font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-primary-500"
                placeholder="000000"
                maxLength={6}
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-dark-300 px-4 py-2 text-gray-700 dark:text-dark-700 hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
                disabled={loading}
                type="button"
              >
                Voltar
              </button>
              <button
                onClick={handleVerification}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || verificationCode.length !== 6}
                type="button"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Verificando...
                  </span>
                ) : (
                  'Ativar 2FA'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TwoFactorSetup
