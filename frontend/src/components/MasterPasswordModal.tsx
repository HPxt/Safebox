import React, { useState } from 'react'
import { X, Lock, Shield, AlertCircle, Info, Eye, EyeOff } from 'lucide-react'
import CryptoService from '../services/cryptoService'
import { supabase } from '../config/supabase'

const passwordInputClasses = 'w-full pl-9 sm:pl-10 pr-10 py-2.5 sm:py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm'

interface MasterPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  isFirstTime?: boolean
  canClose?: boolean
}

const MasterPasswordModal: React.FC<MasterPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isFirstTime = false,
  canClose = true
}) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    score: 0,
    feedback: [] as string[],
    blocked: false,
    blockReason: '' as string | undefined
  })
  const [showInfo, setShowInfo] = useState(false)

  // Atualizar validação quando a senha mudar
  React.useEffect(() => {
    const validation = CryptoService.validatePasswordStrength(password)
    setPasswordValidation({
      ...validation,
      blockReason: validation.blockReason || ''
    })
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Testar Web Crypto API primeiro
      const cryptoAvailable = await CryptoService.testWebCrypto()
      if (!cryptoAvailable) {
        throw new Error('Web Crypto API não está disponível ou funcionando corretamente neste navegador')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (isFirstTime) {
        // Primeiro acesso - configurar criptografia
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem')
        }

        // Usar a nova validação mais rigorosa
        if (passwordValidation.blocked) {
          throw new Error(passwordValidation.blockReason || 'Senha não atende aos critérios de segurança')
        }

        if (!passwordValidation.isValid) {
          throw new Error('Senha não atende aos critérios de segurança. Precisa de pelo menos 7/10 pontos.')
        }

        // Gerar salt
        const salt = CryptoService.generateSalt()
        // Removido log do salt por segurança
        
        // Derivar chave (sempre usando LOW config)
        const key = await CryptoService.deriveKey(password, salt)
        
        // Criar hash da chave para verificação futura
        const keyHash = await CryptoService.hashKey(key)
        
        // Salvar salt, parâmetros e hash no banco - usando configuração LOW fixa
        const { error: updateError } = await supabase
          .from('users')
          .update({
            kdf_salt: salt,
            kdf_params: {
              algorithm: 'argon2id',
              memorySize: 65536,   // 64MB (LOW)
              iterations: 3,        // 3 iterações (LOW)
              parallelism: 4,
              hashLength: 32
            },
            key_hash: keyHash
          })
          .eq('id', user.id)
          .select()

        
        if (updateError) {
          
          // Abordagem alternativa: usar metadados do usuário
          const { error: authUpdateError } = await supabase.auth.updateUser({
            data: {
              kdf_salt: salt,
              kdf_params: {
                algorithm: 'argon2id',
                memorySize: 65536,   // 64MB (LOW)
                iterations: 3,        // 3 iterações (LOW)
                parallelism: 4,
                hashLength: 32
              }
            }
          })
          
          if (authUpdateError) {
            throw updateError // lançar o erro original
          }
          
        }

        // Verificar se realmente foi salvo
        const { data: checkData } = await supabase
          .from('users')
          .select('kdf_salt')
          .eq('id', user.id)
          .single()

        if (!checkData?.kdf_salt) {
          throw new Error('Nao foi possivel concluir a configuracao da senha-mestra')
        }
        

        // Armazenar chave na sessão
        await CryptoService.storeKey(key)
        
        onSuccess()
      } else {
        // Login - verificar senha-mestra COM RATE LIMITING
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('kdf_salt, kdf_params')
          .eq('id', user.id)
          .single()

        if (fetchError) throw fetchError
        if (!userData?.kdf_salt) {
          // Usuário ainda não configurou criptografia
          setError('Por favor, configure sua senha-mestra primeiro')
          return
        }

        // Verificar tentativas falhadas antes de tentar
        const failedAttempts = CryptoService.getFailedAttempts(user.id)
        if (failedAttempts >= 10) {
          throw new Error('Muitas tentativas falhadas. Tente novamente em 1 hora.')
        }

        // Derivar chave com salt existente E RATE LIMITING
        const key = await CryptoService.deriveKeyWithRateLimit(
          password, 
          userData.kdf_salt,
          userData.kdf_params,  // Usar params salvos no banco
          user.id               // Passar userId para rate limiting
        )

        // Verificar se a senha está correta
        const keyHash = await CryptoService.hashKey(key)
        
        // Buscar o hash armazenado
        const { data: userWithHash } = await supabase
          .from('users')
          .select('key_hash')
          .eq('id', user.id)
          .single()
        
        if (userWithHash?.key_hash) {
          // Se já tem hash armazenado, verificar
          if (keyHash !== userWithHash.key_hash) {
            // Registrar tentativa falhada no rate limiting
            CryptoService.recordFailedAttempt(user.id)
            throw new Error('Senha incorreta')
          }
        } else {
          // Se não tem hash armazenado (primeira vez após configurar), salvar
          await supabase
            .from('users')
            .update({ key_hash: keyHash })
            .eq('id', user.id)
        }

        // Se chegou até aqui, senha está correta
        // Limpar tentativas falhadas
        CryptoService.clearFailedAttempts(user.id)

        // Armazenar chave na sessão
        await CryptoService.storeKey(key)
        
        // Não verificar 2FA ao desbloquear o vault - apenas no login
        onSuccess()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar senha-mestra'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Limpar estados ao fechar
    setPassword('')
    setConfirmPassword('')
    setError('')
    setShowInfo(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 overflow-y-auto backdrop-blur-sm"
      onClick={canClose ? (e) => {
        // Fechar apenas se clicar no backdrop e for permitido
        if (e.target === e.currentTarget) {
          handleClose()
        }
      } : undefined}
    >
      <div className="min-h-full flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="bg-white dark:bg-dark-100 rounded-xl w-full max-w-md mx-2 sm:mx-auto p-3 sm:p-5 md:p-6 max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-dark-200">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-dark-900 flex items-center pr-2">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-primary-600 flex-shrink-0" />
            <span className="leading-tight">
              {isFirstTime ? 'Configurar Senha-Mestra' : 'Digite sua Senha-Mestra'}
            </span>
          </h2>
          {canClose && (
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 p-1 transition-colors"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {isFirstTime && (
          <>
            <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 dark:bg-primary-900/20 rounded-lg">
              <div className="flex items-start">
                <Info className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-0.5 sm:mb-1">O que é a senha-mestra?</p>
                  <p className="text-xs leading-relaxed">
                    A senha-mestra é usada para criptografar todas as suas credenciais. 
                    Ela nunca é enviada para nossos servidores e você é o único que a conhece.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 font-medium mt-1 sm:mt-2 text-xs transition-colors"
                  >
                    {showInfo ? 'Ocultar detalhes' : 'Saiba mais'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 dark:text-red-200 flex-1 min-w-0">
                  <p className="font-semibold mb-0.5 text-xs">🚨 AVISO CRÍTICO</p>
                  <p className="mb-1.5 text-xs leading-relaxed">
                    <strong>Não é possível recuperar sua senha-mestra!</strong> Se você esquecê-la, 
                    perderá acesso permanentemente.
                  </p>
                  
                  {/* Seção compacta para mobile */}
                  <div className="bg-red-100 dark:bg-red-950/40 p-1.5 sm:p-2 rounded border-l-3 border-red-500">
                    <p className="font-semibold text-red-900 dark:text-red-100 mb-0.5 text-xs">⚠️ SENHAS BLOQUEADAS:</p>
                    <div className="text-xs space-y-0 leading-tight">
                      <div>• Senhas comuns (123456, password)</div>
                      <div>• Apenas números ou letras</div>
                      <div>• Sequências (123456789, abcdef)</div>
                      <div>• Menos de 12 caracteres</div>
                      <div>• Padrões de teclado (qwerty)</div>
                    </div>
                  </div>
                  
                  <details className="mt-1.5">
                    <summary className="text-xs font-medium cursor-pointer text-red-700 dark:text-red-300">
                      ✅ Ver recomendações de segurança
                    </summary>
                    <ul className="text-xs mt-1 ml-2 space-y-0 leading-tight text-red-700 dark:text-red-300">
                      <li>• Use pelo menos 16 caracteres</li>
                      <li>• Misture maiúsculas, números e símbolos</li>
                      <li>• Use frase memorável: "Casa#Azul@2024!"</li>
                      <li>• Anote em local físico seguro</li>
                    </ul>
                  </details>
                </div>
              </div>
            </div>
          </>
        )}

        {showInfo && (
          <div className="mb-3 p-3 sm:p-4 bg-gray-50 dark:bg-dark-200 rounded-lg text-xs sm:text-sm text-gray-700 dark:text-dark-700">
            <h4 className="font-semibold mb-2 text-xs sm:text-sm text-gray-900 dark:text-dark-900">Como funciona a criptografia:</h4>
            <ul className="space-y-1 text-xs">
              <li>• Usamos Argon2id para derivar chave forte</li>
              <li>• Cada credencial é criptografada com AES-256-GCM</li>
              <li>• Cada item tem seu próprio nonce único</li>
              <li>• Zero-knowledge: nem nós podemos ver seus dados</li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
          {error && (
            <div className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-start">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
              Senha-Mestra
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-dark-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={passwordInputClasses}
                placeholder={isFirstTime ? "Crie uma senha forte" : "Digite sua senha-mestra"}
                required
                disabled={loading}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="new-password"
                spellCheck="false"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          {isFirstTime && (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                  Confirmar Senha-Mestra
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-dark-500" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={passwordInputClasses}
                    placeholder="Confirme sua senha-mestra"
                    required
                    disabled={loading}
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoComplete="new-password"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-800 transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
              </div>

              {password && (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-dark-700">
                      Análise de Segurança
                    </span>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {passwordValidation.blocked ? (
                        <span className="text-xs sm:text-sm font-bold text-red-600 flex items-center">
                          🚫 BLOQUEADA
                        </span>
                      ) : (
                        <span className={`text-xs sm:text-sm font-medium flex items-center ${
                          passwordValidation.score >= 9 ? 'text-green-700' :
                          passwordValidation.score >= 7 ? 'text-blue-600' :
                          passwordValidation.score >= 5 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {passwordValidation.score >= 9 ? '🛡️' :
                           passwordValidation.score >= 7 ? '✅' :
                           passwordValidation.score >= 5 ? '⚠️' : '❌'} 
                          {passwordValidation.score}/10
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-dark-300 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        passwordValidation.blocked ? 'bg-red-500' :
                        passwordValidation.score >= 9 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        passwordValidation.score >= 7 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                        passwordValidation.score >= 5 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                        'bg-gradient-to-r from-red-500 to-red-600'
                      }`}
                      style={{ 
                        width: passwordValidation.blocked ? '100%' : `${Math.max(passwordValidation.score * 10, 10)}%` 
                      }}
                    />
                  </div>

                  {/* Status visual com cor de fundo - otimizado para mobile */}
                  <div className={`p-2 sm:p-3 rounded-lg border-l-4 ${
                    passwordValidation.blocked ? 'bg-red-50 dark:bg-red-900/20 border-red-400' :
                    passwordValidation.score >= 9 ? 'bg-green-50 dark:bg-green-900/20 border-green-400' :
                    passwordValidation.score >= 7 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400' :
                    passwordValidation.score >= 5 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400' :
                    'bg-red-50 dark:bg-red-900/20 border-red-400'
                  }`}>
                    <div className={`text-xs sm:text-sm font-medium mb-1 ${
                      passwordValidation.blocked ? 'text-red-800 dark:text-red-200' :
                      passwordValidation.score >= 9 ? 'text-green-800 dark:text-green-200' :
                      passwordValidation.score >= 7 ? 'text-blue-800 dark:text-blue-200' :
                      passwordValidation.score >= 5 ? 'text-yellow-800 dark:text-yellow-200' :
                      'text-red-800 dark:text-red-200'
                    }`}>
                      {passwordValidation.blocked ? '🚫 Senha Rejeitada' :
                       passwordValidation.score >= 9 ? '🛡️ Excelente!' :
                       passwordValidation.score >= 7 ? '✅ Boa!' :
                       passwordValidation.score >= 5 ? '⚠️ Razoável' :
                       '❌ Fraca'}
                    </div>
                    
                    {passwordValidation.feedback.length > 0 && (
                      <div className={`text-xs space-y-0.5 ${
                        passwordValidation.blocked ? 'text-red-700 dark:text-red-300' :
                        passwordValidation.score >= 9 ? 'text-green-700 dark:text-green-300' :
                        passwordValidation.score >= 7 ? 'text-blue-700 dark:text-blue-300' :
                        passwordValidation.score >= 5 ? 'text-yellow-700 dark:text-yellow-300' :
                        'text-red-700 dark:text-red-300'
                      }`}>
                        {passwordValidation.feedback.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex items-start">
                            <span className="mr-1 flex-shrink-0">•</span>
                            <span className="text-xs">{item}</span>
                          </div>
                        ))}
                        {passwordValidation.feedback.length > 3 && (
                          <div className="text-xs opacity-75">
                            +{passwordValidation.feedback.length - 3} mais...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tempo estimado - mais compacto no mobile */}
                  {passwordValidation.score >= 5 && (
                    <div className="text-xs text-gray-600 dark:text-dark-700 bg-gray-50 dark:bg-dark-200 p-2 rounded">
                      💡 <strong>Resistência:</strong> {
                        passwordValidation.score >= 9 ? 'Milhares de anos' :
                        passwordValidation.score >= 7 ? 'Décadas' :
                        'Anos'
                      }
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 sm:gap-3 pt-2">
            {canClose && (
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-dark-300 text-gray-700 dark:text-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 text-sm font-medium transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={`${canClose ? 'flex-1' : 'w-full'} px-3 sm:px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium`}
              disabled={loading || (isFirstTime && (!passwordValidation.isValid || password !== confirmPassword))}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  <span className="text-xs sm:text-sm">Processando...</span>
                </span>
              ) : (
                <span className="text-sm">{isFirstTime ? 'Configurar' : 'Desbloquear'}</span>
              )}
            </button>
          </div>
        </form>

        {!isFirstTime && (
          <p className="text-xs text-gray-500 dark:text-dark-600 text-center mt-3 sm:mt-4">
            Esqueceu sua senha-mestra? 
            <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ml-1 text-xs transition-colors">
              Saiba mais
            </button>
          </p>
        )}
        </div>
      </div>
    </div>
  )
}

export default MasterPasswordModal 
