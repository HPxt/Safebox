import React, { useState } from 'react'
import { Upload, Download, FileJson, AlertCircle, CheckCircle, X, Lock, FolderOpen } from 'lucide-react'
import ImportExportService from '../services/importExportService'
import CryptoService from '../services/cryptoService'
import { ExportFormat, ImportSource } from '../types/import-export'
import { supabase } from '../config/supabase'
import { Folder } from '../types'

interface ImportExportProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

const ImportExport: React.FC<ImportExportProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('export')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [exportPassword, setExportPassword] = useState('')
  const [importSource, setImportSource] = useState<ImportSource>('bitwarden')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)
  const [isVaultLocked, setIsVaultLocked] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Verificar status do vault ao abrir
  React.useEffect(() => {
    const checkVault = async () => {
      const key = await CryptoService.getStoredKey()
      setIsVaultLocked(!key)
      
      // Se o vault está desbloqueado, buscar pastas
      if (key && isOpen) {
        await fetchFolders()
      }
    }
    if (isOpen) {
      checkVault()
    }
  }, [isOpen])

  const fetchFolders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (!error && data) {
        setFolders(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pastas:', error)
    }
  }

  if (!isOpen) return null

  const checkVaultUnlocked = async (): Promise<boolean> => {
    const key = await CryptoService.getStoredKey()
    if (!key) {
      setMessage({ 
        type: 'error', 
        text: 'O cofre precisa estar desbloqueado. Por favor, desbloqueie o cofre com sua senha mestre primeiro.' 
      })
      return false
    }
    return true
  }

  const handleExport = async () => {
    try {
      setLoading(true)
      setMessage(null)

      // Verificar se o vault está desbloqueado
      if (!await checkVaultUnlocked()) {
        setLoading(false)
        return
      }

      const { data, filename } = await ImportExportService.exportData(
        exportFormat,
        exportFormat === 'json-encrypted' ? exportPassword : undefined
      )

      // Criar link de download
      const blob = data instanceof Blob ? data : new Blob([data], { 
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: 'Dados exportados com sucesso!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao exportar dados' })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'Selecione um arquivo para importar' })
      return
    }

    try {
      setLoading(true)
      setMessage(null)

      // Verificar se o vault está desbloqueado
      if (!await checkVaultUnlocked()) {
        setLoading(false)
        return
      }

      const { imported, errors } = await ImportExportService.importData(
        importFile,
        importSource,
        importSource === 'safebox-json' ? importPassword : undefined,
        selectedFolderId
      )

      if (errors.length > 0) {
        const duplicateCount = errors.filter(err => err.includes('já existe')).length
        const otherErrors = errors.filter(err => !err.includes('já existe'))
        
        if (duplicateCount > 0 && otherErrors.length === 0) {
          setMessage({
            type: 'info',
            text: `✅ ${imported} credenciais importadas. ${duplicateCount} já existiam e foram ignoradas.`
          })
        } else if (duplicateCount > 0 && otherErrors.length > 0) {
          setMessage({
            type: 'warning',
            text: `✅ ${imported} importadas. ${duplicateCount} ignoradas (duplicadas). ⚠️ ${otherErrors.length} erros.`
          })
          console.error('Erros durante importação:', otherErrors)
        } else {
          setMessage({
            type: 'error',
            text: `${imported} importadas com ${otherErrors.length} erros.`
          })
          console.error('Erros durante importação:', otherErrors)
        }
      } else {
        setMessage({
          type: 'success',
          text: `✅ ${imported} credenciais importadas com sucesso!`
        })
      }

      // Limpar formulário
      setImportFile(null)
      setImportPassword('')
      
      // Notificar componente pai
      if (onImportComplete) {
        onImportComplete()
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao importar dados' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      
      // Auto-detectar formato baseado no nome do arquivo
      if (file.name.includes('bitwarden')) {
        setImportSource('bitwarden')
      } else if (file.name.includes('lastpass')) {
        setImportSource('lastpass')
      } else if (file.name.includes('1password')) {
        setImportSource('1password')
      } else if (file.name.includes('keepass')) {
        setImportSource('keepass')
      } else if (file.name.includes('safebox')) {
        setImportSource('safebox-json')
      } else if (file.name.endsWith('.csv')) {
        setImportSource('generic-csv')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Importar/Exportar Dados
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Download className="w-4 h-4 inline-block mr-2" />
            Exportar
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4 inline-block mr-2" />
            Importar
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Aviso se o vault estiver bloqueado */}
          {isVaultLocked && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <Lock className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Cofre Bloqueado
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    O cofre precisa estar desbloqueado para importar ou exportar dados.
                    Por favor, desbloqueie o cofre com sua senha mestre primeiro.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* Aviso */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Exportando Cofre Pessoal
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Apenas os itens individuais do cofre associados a {localStorage.getItem('userEmail')} serão exportados.
                      Os itens do cofre da organização não serão incluídos.
                      Apenas as informações de item do cofre serão exportadas e não incluirão anexos associados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Formato de Arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato do Arquivo
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">.json</div>
                      <div className="text-sm text-gray-600">Formato SafeBox (recomendado para backup)</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">.csv</div>
                      <div className="text-sm text-gray-600">Compatível com outros gerenciadores</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="json-encrypted"
                      checked={exportFormat === 'json-encrypted'}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">.json (Criptografado)</div>
                      <div className="text-sm text-gray-600">Protegido por senha adicional</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors opacity-50">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="zip"
                      checked={exportFormat === 'zip'}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="mr-3"
                      disabled
                    />
                    <div className="flex-1">
                      <div className="font-medium">.zip (com anexos)</div>
                      <div className="text-sm text-gray-600">Em breve - Incluirá anexos</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Senha para exportação criptografada */}
              {exportFormat === 'json-encrypted' && (
                <div className="space-y-3">
                  <label htmlFor="exportPassword" className="block text-sm font-medium text-gray-700">
                    Senha de Exportação - SEGURANÇA MÁXIMA
                  </label>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <div className="flex items-start">
                      <AlertCircle className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">⚠️ Esta senha protegerá TODOS os seus dados</p>
                        <p>Use uma senha forte - será aplicada dupla criptografia com Argon2id + AES-256-GCM</p>
                      </div>
                    </div>
                  </div>

                  <input
                    type="password"
                    id="exportPassword"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Digite uma senha forte (min. 12 caracteres)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {exportPassword && (() => {
                    const validation = CryptoService.validatePasswordStrength(exportPassword)
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Força da Senha de Exportação
                          </span>
                          <span className={`text-xs font-medium ${
                            validation.blocked ? 'text-red-600' :
                            validation.score >= 7 ? 'text-green-600' :
                            validation.score >= 5 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {validation.blocked ? 'BLOQUEADA' : `${validation.score}/10`}
                          </span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              validation.blocked ? 'bg-red-500' :
                              validation.score >= 7 ? 'bg-green-500' :
                              validation.score >= 5 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ 
                              width: validation.blocked ? '100%' : `${Math.max(validation.score * 10, 10)}%` 
                            }}
                          />
                        </div>
                        
                        {(validation.blocked || !validation.isValid) && (
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-xs text-red-800 font-medium mb-1">
                              {validation.blocked ? '🚫 Senha rejeitada:' : '⚠️ Senha fraca:'}
                            </p>
                            <ul className="text-xs text-red-700 space-y-1">
                              {validation.feedback.slice(0, 3).map((item, index) => (
                                <li key={index}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {validation.isValid && !validation.blocked && (
                          <div className="bg-green-50 border border-green-200 rounded p-2">
                            <p className="text-xs text-green-800 font-medium">
                              ✅ Senha aceita! Estimativa: {
                                validation.score >= 9 ? 'Milhares de anos para quebrar' :
                                validation.score >= 7 ? 'Décadas para quebrar' :
                                'Anos para quebrar'
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">🔐 Segurança da Exportação:</p>
                      <ul className="text-xs space-y-1">
                        <li>• Dupla derivação com Argon2id (256MB RAM + 8 iterações)</li>
                        <li>• Criptografia AES-256-GCM com salt único</li>
                        <li>• Hash de integridade para detectar alterações</li>
                        <li>• Esta senha será necessária para importar</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Seleção de arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o arquivo de importação
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".json,.csv,.xml,.1pux"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="fileInput"
                  />
                  <label htmlFor="fileInput" className="cursor-pointer">
                    <FileJson className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      {importFile ? (
                        <span className="font-medium text-blue-600">{importFile.name}</span>
                      ) : (
                        <>
                          <span className="font-medium text-blue-600">Clique para selecionar</span>
                          {' ou arraste o arquivo aqui'}
                        </>
                      )}
                    </p>
                  </label>
                </div>
              </div>

              {/* Formato do arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato do Arquivo
                </label>
                <select
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value as ImportSource)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <optgroup label="Formatos comuns">
                    <option value="bitwarden">Bitwarden (json/csv)</option>
                    <option value="lastpass">LastPass (csv)</option>
                    <option value="1password">1Password (1pux/json)</option>
                    <option value="keepass">KeePass 2 (xml)</option>
                    <option value="chrome">Chrome (csv)</option>
                    <option value="firefox">Firefox (csv)</option>
                    <option value="dashlane">Dashlane (csv)</option>
                    <option value="safari">Safari/macOS (csv)</option>
                  </optgroup>
                  <optgroup label="Outros">
                    <option value="safebox-json">SafeBox (json)</option>
                    <option value="generic-csv">CSV Genérico</option>
                  </optgroup>
                </select>
              </div>

              {/* Senha para importação criptografada */}
              {importSource === 'safebox-json' && (
                <div>
                  <label htmlFor="importPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Senha do Arquivo (se criptografado)
                  </label>
                  <input
                    type="password"
                    id="importPassword"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Digite a senha usada na exportação"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Seleção de pasta de destino */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Importar para pasta (opcional)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFolderId || ''}
                      onChange={(e) => setSelectedFolderId(e.target.value || null)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                    >
                      <option value="">Sem pasta específica</option>
                      {folders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Todas as credenciais importadas serão adicionadas a esta pasta
                  </p>
                </div>
              )}

              {/* Informações sobre o formato */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Dicas para importação:
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {importSource === 'bitwarden' && (
                    <>
                      <li>• Exporte do Bitwarden em formato JSON ou CSV</li>
                      <li>• Vá em Configurações → Exportar cofre</li>
                    </>
                  )}
                  {importSource === 'lastpass' && (
                    <>
                      <li>• Exporte do LastPass em formato CSV</li>
                      <li>• Vá em Mais opções → Avançado → Exportar</li>
                    </>
                  )}
                  {importSource === '1password' && (
                    <>
                      <li>• Exporte do 1Password em formato 1PUX ou JSON</li>
                      <li>• Vá em Configurações → Exportar dados</li>
                    </>
                  )}
                  {importSource === 'chrome' && (
                    <>
                      <li>• Exporte do Chrome em formato CSV</li>
                      <li>• Vá em chrome://settings/passwords → ⋮ → Exportar senhas</li>
                    </>
                  )}
                  {importSource === 'generic-csv' && (
                    <>
                      <li>• O arquivo deve ter colunas: name, username, password, url</li>
                      <li>• Outras colunas opcionais: notes, folder, totp</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Mensagens */}
          {message && (
            <div className={`mt-6 p-4 rounded-lg flex items-start ${
              message.type === 'success' ? 'bg-green-50 text-green-800' :
              message.type === 'error' ? 'bg-red-50 text-red-800' :
              message.type === 'info' ? 'bg-blue-50 text-blue-800' :
              'bg-yellow-50 text-yellow-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={activeTab === 'export' ? handleExport : handleImport}
            disabled={loading || isVaultLocked || (activeTab === 'import' && !importFile) || (activeTab === 'export' && exportFormat === 'json-encrypted' && !exportPassword)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processando...
              </>
            ) : isVaultLocked ? (
              <>
                <Lock className="w-4 h-4" />
                Cofre Bloqueado
              </>
            ) : (
              <>
                {activeTab === 'export' ? (
                  <>
                    <Download className="w-4 h-4" />
                    Exportar Dados
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar Dados
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportExport 