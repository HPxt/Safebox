import React, { useState } from 'react'
import { 
  Settings2, 
  Eye, 
  EyeOff, 
  Clock, 
  LayoutGrid, 
  Key, 
  Clipboard,
  Loader2
} from 'lucide-react'
import { usePreferences } from '../contexts/PreferencesContext'

const PreferencesSettings: React.FC = () => {
  const { preferences, updatePreferences, loading } = usePreferences()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleToggle = async (key: keyof typeof preferences, value: boolean) => {
    try {
      setSaving(true)
      setMessage(null)
      await updatePreferences({ [key]: value })
      setMessage({ type: 'success', text: 'Preferência atualizada com sucesso!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar preferência.' })
    } finally {
      setSaving(false)
    }
  }

  const handleNumberChange = async (key: keyof typeof preferences, value: number) => {
    try {
      setSaving(true)
      setMessage(null)
      await updatePreferences({ [key]: value })
      setMessage({ type: 'success', text: 'Preferência atualizada com sucesso!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar preferência.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 mb-4 flex items-center">
        <Settings2 className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
        Preferências
      </h3>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Tempo de bloqueio automático */}
        <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-dark-900">
                  Tempo de bloqueio automático
                </h4>
                <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
                  Bloqueia o vault após período de inatividade
                </p>
              </div>
            </div>
            <select
              value={preferences.autoLockTimeout}
              onChange={(e) => handleNumberChange('autoLockTimeout', parseInt(e.target.value))}
              disabled={saving}
              className="px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg text-sm bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900 focus:ring-2 focus:ring-primary-500"
            >
              <option value={5}>5 minutos</option>
              <option value={10}>10 minutos</option>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
            </select>
          </div>
        </div>

        {/* Tamanho padrão de senha */}
        <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Key className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-dark-900">
                  Tamanho padrão de senha
                </h4>
                <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
                  Tamanho ao gerar novas senhas
                </p>
              </div>
            </div>
            <select
              value={preferences.defaultPasswordLength}
              onChange={(e) => handleNumberChange('defaultPasswordLength', parseInt(e.target.value))}
              disabled={saving}
              className="px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg text-sm bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900 focus:ring-2 focus:ring-primary-500"
            >
              <option value={12}>12 caracteres</option>
              <option value={16}>16 caracteres</option>
              <option value={20}>20 caracteres</option>
              <option value={24}>24 caracteres</option>
              <option value={32}>32 caracteres</option>
            </select>
          </div>
        </div>

        {/* Tempo de limpeza do clipboard */}
        <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Clipboard className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-dark-900">
                  Limpar área de transferência
                </h4>
                <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
                  Limpa automaticamente após copiar senhas
                </p>
              </div>
            </div>
            <select
              value={preferences.clipboardTimeout}
              onChange={(e) => handleNumberChange('clipboardTimeout', parseInt(e.target.value))}
              disabled={saving}
              className="px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg text-sm bg-white dark:bg-dark-100 text-gray-900 dark:text-dark-900 focus:ring-2 focus:ring-primary-500"
            >
              <option value={15}>15 segundos</option>
              <option value={30}>30 segundos</option>
              <option value={60}>1 minuto</option>
              <option value={120}>2 minutos</option>
              <option value={0}>Nunca</option>
            </select>
          </div>
        </div>

        {/* Modo compacto */}
        <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <LayoutGrid className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-dark-900">
                  Modo compacto
                </h4>
                <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
                  Exibe mais credenciais na tela
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('compactMode', !preferences.compactMode)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                preferences.compactMode 
                  ? 'bg-primary-600' 
                  : 'bg-gray-300 dark:bg-dark-400'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.compactMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Separador visual */}
        <div className="border-t border-gray-200 dark:border-dark-300 my-6"></div>

        {/* Seção de Credenciais Ocultas */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3">
              {preferences.showHiddenCredentials ? (
                <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              ) : (
                <EyeOff className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              )}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-dark-900">
                  Mostrar credenciais ocultas
                </h4>
                <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
                  Quando ativado, exibe o menu "Ocultos" no Dashboard para acessar credenciais marcadas como ocultas
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('showHiddenCredentials', !preferences.showHiddenCredentials)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                preferences.showHiddenCredentials 
                  ? 'bg-amber-600' 
                  : 'bg-gray-300 dark:bg-dark-400'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showHiddenCredentials ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {preferences.showHiddenCredentials && (
            <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded text-sm text-amber-800 dark:text-amber-300">
              <strong>Dica:</strong> Para ocultar uma credencial, edite-a e marque a opção "Ocultar credencial". 
              Ela será movida para a seção "Ocultos" e não aparecerá no Dashboard principal.
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="flex items-center justify-center text-sm text-gray-500 dark:text-dark-600">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Salvando...
        </div>
      )}
    </div>
  )
}

export default PreferencesSettings
