import React, { useState } from 'react'
import { Shield, Lock, AlertCircle, Info, CheckCircle } from 'lucide-react'
import CryptoService from '../services/cryptoService'
import { supabase } from '../config/supabase'
import { useAuth } from '../contexts/AuthContext'

interface SecurityLevel {
  name: string
  label: string
  description: string
  memorySize: number
  iterations: number
  color: string
  icon: string
}

const SECURITY_LEVELS: SecurityLevel[] = [
  {
    name: 'low',
    label: 'Básico',
    description: '✅ Login rápido (< 0.5s) | ⚡ Ideal para dispositivos móveis | ⚠️ Segurança básica',
    memorySize: 64 * 1024,  // 64 MB
    iterations: 3,
    color: 'blue',
    icon: '🔵'
  },
  {
    name: 'medium',
    label: 'Recomendado',
    description: '✅ Equilíbrio perfeito | 🛡️ Boa segurança | ⏱️ Login em ~1s | 💻 Funciona bem em qualquer PC',
    memorySize: 96 * 1024,  // 96 MB
    iterations: 4,
    color: 'green',
    icon: '🟢'
  },
  {
    name: 'high',
    label: 'Máximo',
    description: '✅ Segurança de nível bancário | 🔒 Muito resistente a ataques | ⏱️ Login em 1-2s | ⚠️ Requer PC moderno',
    memorySize: 128 * 1024, // 128 MB
    iterations: 5,
    color: 'orange',
    icon: '🟠'
  },
  {
    name: 'ultra',
    label: 'Ultra',
    description: '🛡️ Segurança paranóica | ⚠️ Login em 2-3s | 🖥️ Apenas para PCs potentes | ❌ Lento em dispositivos móveis',
    memorySize: 256 * 1024, // 256 MB
    iterations: 6,
    color: 'red',
    icon: '🔴'
  }
]

const MasterPasswordSettings: React.FC = () => {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<SecurityLevel>(SECURITY_LEVELS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentLevel, setCurrentLevel] = useState<string>('')

  // Carregar nível atual do usuário
  React.useEffect(() => {
    const loadCurrentLevel = async () => {
      if (!user) return

      try {
        const { data } = await supabase
          .from('users')
          .select('kdf_params')
          .eq('id', user.id)
          .single()

        if (data?.kdf_params) {
          const memorySize = data.kdf_params.memorySize
          const currentLevelObj = SECURITY_LEVELS.find(level => 
            level.memorySize === memorySize
          )
          if (currentLevelObj) {
            setCurrentLevel(currentLevelObj.label)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar nível atual:', error)
      }
    }

    loadCurrentLevel()
  }, [user])

  const passwordValidation = CryptoService.validatePasswordStrength(newPassword)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validações
    if (!passwordValidation.isValid) {
      setError('A nova senha não atende aos critérios de segurança')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      if (!user) throw new Error('Usuário não autenticado')

      // Primeiro, verificar a senha atual
      const { data: userData } = await supabase
        .from('users')
        .select('kdf_salt, kdf_params')
        .eq('id', user.id)
        .single()

      if (!userData?.kdf_salt) {
        throw new Error('Dados de criptografia não encontrados')
      }

      // Verificar senha atual
      try {
        const currentKey = await CryptoService.deriveKeyWithRateLimit(
          currentPassword,
          userData.kdf_salt,
          userData.kdf_params,
          user.id
        )

        const currentKeyHash = await CryptoService.hashKey(currentKey)
        
        // Buscar hash armazenado
        const { data: userWithHash } = await supabase
          .from('users')
          .select('key_hash')
          .eq('id', user.id)
          .single()

        if (userWithHash?.key_hash && currentKeyHash !== userWithHash.key_hash) {
          throw new Error('Senha atual incorreta')
        }
      } catch (err: any) {
        if (err.message === 'Senha atual incorreta') {
          throw err
        }
        throw new Error('Erro ao verificar senha atual')
      }

      // Gerar novo salt
      const newSalt = CryptoService.generateSalt()
      
      // Derivar nova chave com os parâmetros selecionados
      const newKey = await CryptoService.deriveKey(
        newPassword,
        newSalt,
        {
          memorySize: selectedLevel.memorySize,
          iterations: selectedLevel.iterations,
          parallelism: 4,
          hashLength: 32
        }
      )

      const newKeyHash = await CryptoService.hashKey(newKey)

      // Re-criptografar todas as credenciais com a nova chave
      const { data: credentials } = await supabase
        .from('credentials')
        .select('*')
        .eq('user_id', user.id)

      if (credentials && credentials.length > 0) {
        // Descriptografar com a chave antiga e re-criptografar com a nova
        const currentKey = await CryptoService.deriveKeyWithRateLimit(
          currentPassword,
          userData.kdf_salt,
          userData.kdf_params,
          user.id
        )

        for (const cred of credentials) {
          try {
            // Descriptografar com chave antiga
            const decryptedPassword = await CryptoService.decrypt(
              cred.encrypted_password,
              currentKey,
              cred.nonce
            )

            // Re-criptografar com nova chave
            const { encrypted, nonce } = await CryptoService.encrypt(
              decryptedPassword,
              newKey
            )

            // Atualizar no banco
            await supabase
              .from('credentials')
              .update({
                encrypted_password: encrypted,
                nonce: nonce
              })
              .eq('id', cred.id)
          } catch (error) {
            console.error(`Erro ao re-criptografar credencial ${cred.id}:`, error)
          }
        }
      }

      // Atualizar parâmetros do usuário
      const { error: updateError } = await supabase
        .from('users')
        .update({
          kdf_salt: newSalt,
          kdf_params: {
            algorithm: 'argon2id',
            memorySize: selectedLevel.memorySize,
            iterations: selectedLevel.iterations,
            parallelism: 4,
            hashLength: 32
          },
          key_hash: newKeyHash
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Armazenar nova chave na sessão
      await CryptoService.storeKey(newKey)

      setSuccess(`Senha mestre alterada com sucesso! Nível de segurança: ${selectedLevel.label}`)
      setCurrentLevel(selectedLevel.label)
      
      // Limpar campos
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error('Erro ao alterar senha mestre:', err)
      setError(err.message || 'Erro ao alterar senha mestre')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-dark-100 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
          Alterar Senha Mestre
        </h3>
        <p className="text-sm text-gray-600 dark:text-dark-700 mt-1">
          Altere sua senha mestre e o nível de segurança da criptografia
        </p>
        {currentLevel && (
          <p className="text-sm text-primary-600 dark:text-primary-400 mt-2">
            Nível atual: <strong>{currentLevel}</strong>
          </p>
        )}
      </div>

      {/* Avisos */}
      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">Importante:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ao alterar a senha mestre, todas as suas credenciais serão re-criptografadas</li>
              <li>Este processo pode levar alguns segundos dependendo da quantidade de dados</li>
              <li>Certifique-se de lembrar da nova senha - não há como recuperá-la</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Senha Atual */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
            Senha Atual
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-dark-500" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-200"
              placeholder="Digite sua senha atual"
              required
              disabled={loading}
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Nova Senha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
            Nova Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-dark-500" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-200"
              placeholder="Digite a nova senha"
              required
              disabled={loading}
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Confirmar Nova Senha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
            Confirmar Nova Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-dark-500" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-200"
              placeholder="Confirme a nova senha"
              required
              disabled={loading}
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Validação de senha */}
        {newPassword && (
          <div className="p-3 bg-gray-50 dark:bg-dark-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-dark-700">Força da senha</span>
              <span className={`text-sm font-medium ${
                passwordValidation.score >= 7 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {passwordValidation.score}/10
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-dark-300 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  passwordValidation.score >= 7 ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(passwordValidation.score * 10, 10)}%` }}
              />
            </div>
          </div>
        )}

        {/* Seletor de Nível de Segurança */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-3">
            Nível de Segurança
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECURITY_LEVELS.map((level) => (
              <button
                key={level.name}
                type="button"
                onClick={() => setSelectedLevel(level)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedLevel.name === level.name
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-300 hover:border-gray-300 dark:hover:border-dark-400'
                }`}
                disabled={loading}
              >
                <div className="flex items-start">
                  <div className="text-3xl mr-3">{level.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-dark-900 text-lg">{level.label}</h4>
                    
                    {/* Descrição com prós e contras */}
                    <p className="text-sm text-gray-600 dark:text-dark-700 mt-2 leading-relaxed">
                      {level.description}
                    </p>
                    
                    {/* Especificações técnicas */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-dark-600">
                      <div className="flex items-center">
                        <span className="font-medium">RAM:</span>
                        <span className="ml-1">{level.memorySize / 1024}MB</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium">Iterações:</span>
                        <span className="ml-1">{level.iterations}x</span>
                      </div>
                    </div>
                    
                    {/* Indicador de performance */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-dark-600">Velocidade</span>
                        <span className="text-gray-500 dark:text-dark-600">Segurança</span>
                      </div>
                      <div className="relative h-2 bg-gray-200 dark:bg-dark-300 rounded-full overflow-hidden">
                        <div 
                          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                            level.name === 'low' ? 'bg-blue-500 w-full' :
                            level.name === 'medium' ? 'bg-green-500 w-3/4' :
                            level.name === 'high' ? 'bg-orange-500 w-1/2' :
                            'bg-red-500 w-1/4'
                          }`}
                        />
                        <div 
                          className={`absolute right-0 top-0 h-full rounded-full transition-all ${
                            level.name === 'low' ? 'bg-gray-300 dark:bg-dark-400 w-1/4' :
                            level.name === 'medium' ? 'bg-gray-300 dark:bg-dark-400 w-1/2' :
                            level.name === 'high' ? 'bg-gray-300 dark:bg-dark-400 w-3/4' :
                            'bg-gray-300 dark:bg-dark-400 w-full'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Aviso especial para ULTRA */}
          {selectedLevel.name === 'ultra' && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>⚠️ Atenção:</strong> O nível Ultra é recomendado apenas para PCs com alta performance. 
                O login pode levar 2-3 segundos e será muito lento em dispositivos móveis.
              </p>
            </div>
          )}
          
          {/* Tabela comparativa */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-dark-700 mb-3">📊 Comparação Detalhada</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-dark-600">
                    <th className="pb-2">Nível</th>
                    <th className="pb-2">Tempo Login</th>
                    <th className="pb-2">Resistência</th>
                    <th className="pb-2">Ideal Para</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-dark-700">
                  <tr>
                    <td className="py-1">🔵 Básico</td>
                    <td>&lt; 0.5s</td>
                    <td>Básica</td>
                    <td>Uso diário, dispositivos móveis</td>
                  </tr>
                  <tr>
                    <td className="py-1">🟢 Recomendado</td>
                    <td>~1s</td>
                    <td>Boa</td>
                    <td>Maioria dos usuários</td>
                  </tr>
                  <tr>
                    <td className="py-1">🟠 Máximo</td>
                    <td>1-2s</td>
                    <td>Excelente</td>
                    <td>Dados sensíveis</td>
                  </tr>
                  <tr>
                    <td className="py-1">🔴 Ultra</td>
                    <td>2-3s</td>
                    <td>Paranóica</td>
                    <td>Segurança extrema</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !passwordValidation.isValid || newPassword !== confirmPassword}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Alterando...
              </span>
            ) : (
              'Alterar Senha Mestre'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MasterPasswordSettings 