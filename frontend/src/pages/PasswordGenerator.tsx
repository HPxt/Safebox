import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  RefreshCw, 
  Copy, 
  Check, 
  Settings,
  Shuffle,
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  History,
  Download
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface GeneratorOptions {
  length: number
  includeUppercase: boolean
  includeLowercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  excludeAmbiguous: boolean
  minNumbers: number
  minSpecial: number
}

interface PasswordHistory {
  id: string
  password: string
  timestamp: Date
  strength: number
}

const PasswordGeneratorPage: React.FC = () => {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<PasswordHistory[]>([])
  
  const [options, setOptions] = useState<GeneratorOptions>({
    length: 14,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
    excludeAmbiguous: false,
    minNumbers: 1,
    minSpecial: 0
  })

  // Caracteres disponíveis
  const chars = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    ambiguous: '0O1lI|`'
  }

  const generatePassword = () => {
    let charset = ''
    let requiredChars = ''

    // Construir conjunto de caracteres
    if (options.includeUppercase) {
      const upperChars = options.excludeAmbiguous 
        ? chars.uppercase.replace(/[O]/g, '') 
        : chars.uppercase
      charset += upperChars
      requiredChars += upperChars[Math.floor(Math.random() * upperChars.length)]
    }

    if (options.includeLowercase) {
      const lowerChars = options.excludeAmbiguous 
        ? chars.lowercase.replace(/[l]/g, '') 
        : chars.lowercase
      charset += lowerChars
      requiredChars += lowerChars[Math.floor(Math.random() * lowerChars.length)]
    }

    if (options.includeNumbers) {
      const numberChars = options.excludeAmbiguous 
        ? chars.numbers.replace(/[01]/g, '') 
        : chars.numbers
      charset += numberChars
      
      // Adicionar números mínimos
      for (let i = 0; i < options.minNumbers; i++) {
        requiredChars += numberChars[Math.floor(Math.random() * numberChars.length)]
      }
    }

    if (options.includeSymbols) {
      const symbolChars = options.excludeAmbiguous 
        ? chars.symbols.replace(/[|`]/g, '') 
        : chars.symbols
      charset += symbolChars
      
      // Adicionar símbolos mínimos
      for (let i = 0; i < options.minSpecial; i++) {
        requiredChars += symbolChars[Math.floor(Math.random() * symbolChars.length)]
      }
    }

    if (!charset) {
      return 'Selecione pelo menos um tipo de caractere'
    }

    // Gerar senha
    let result = requiredChars
    
    // Preencher o restante
    for (let i = result.length; i < options.length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)]
    }

    // Embaralhar a senha
    result = result.split('').sort(() => Math.random() - 0.5).join('')

    return result
  }

  const handleGenerate = () => {
    const newPassword = generatePassword()
    setPassword(newPassword)
    setCopied(false)
    
    // Adicionar ao histórico
    const newEntry: PasswordHistory = {
      id: crypto.randomUUID(),
      password: newPassword,
      timestamp: new Date(),
      strength: calculateStrength(newPassword)
    }
    
    setHistory(prev => [newEntry, ...prev.slice(0, 9)]) // Manter apenas 10 últimas
  }

  const copyToClipboard = async (text: string = password) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Erro ao copiar senha:', error)
    }
  }

  const updateOption = (key: keyof GeneratorOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }

  const calculateStrength = (pwd: string) => {
    if (!pwd) return 0
    
    let score = 0
    if (pwd.length >= 8) score += 1
    if (pwd.length >= 12) score += 1
    if (/[a-z]/.test(pwd)) score += 1
    if (/[A-Z]/.test(pwd)) score += 1
    if (/[0-9]/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    return Math.min(score, 6)
  }

  const getPasswordStrength = (pwd: string = password) => {
    const score = calculateStrength(pwd)
    
    const levels = [
      { score: 0, label: 'Muito Fraca', color: 'bg-red-500', textColor: 'text-red-600' },
      { score: 1, label: 'Fraca', color: 'bg-red-400', textColor: 'text-red-600' },
      { score: 2, label: 'Fraca', color: 'bg-orange-400', textColor: 'text-orange-600' },
      { score: 3, label: 'Média', color: 'bg-yellow-400', textColor: 'text-yellow-600' },
      { score: 4, label: 'Forte', color: 'bg-blue-400', textColor: 'text-blue-600' },
      { score: 5, label: 'Muito Forte', color: 'bg-green-400', textColor: 'text-green-600' },
      { score: 6, label: 'Excelente', color: 'bg-green-500', textColor: 'text-green-600' }
    ]

    return levels[Math.min(score, 6)]
  }

  const exportHistory = () => {
    const data = history.map(item => ({
      password: item.password,
      timestamp: item.timestamp.toISOString(),
      strength: getPasswordStrength(item.password).label
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `senhas-geradas-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Gerar senha inicial
  useEffect(() => {
    handleGenerate()
  }, [options])

  const strength = getPasswordStrength()

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <h1 className="ml-3 text-xl font-bold text-secondary-900">Gerador de Senhas</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${
                  showHistory 
                    ? 'bg-primary-100 text-primary-600' 
                    : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
                }`}
              >
                <History className="h-5 w-5" />
              </button>
              <span className="text-sm text-secondary-600">
                {user?.email?.split('@')[0] || 'Usuário'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Gerador Principal */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Configurações</h2>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-2 rounded-lg transition-colors ${
                    showAdvanced 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {/* Senha Gerada */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha Gerada
                </label>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Senha gerada aparecerá aqui"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-12 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => copyToClipboard()}
                    className={`p-3 rounded-lg transition-colors ${
                      copied 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  
                  <button
                    onClick={handleGenerate}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                {/* Indicador de Força */}
                {password && (
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(calculateStrength(password) / 6) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${strength.textColor}`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Controles Básicos */}
              <div className="space-y-6">
                {/* Comprimento */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Comprimento
                    </label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {options.length}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="128"
                    value={options.length}
                    onChange={(e) => updateOption('length', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>4</span>
                    <span>Use 14 caracteres ou mais para senhas fortes</span>
                    <span>128</span>
                  </div>
                </div>

                {/* Tipos de Caracteres */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">
                    Incluir
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={options.includeUppercase}
                        onChange={(e) => updateOption('includeUppercase', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">A-Z</span>
                        <p className="text-xs text-gray-500">Letras maiúsculas</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={options.includeLowercase}
                        onChange={(e) => updateOption('includeLowercase', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">a-z</span>
                        <p className="text-xs text-gray-500">Letras minúsculas</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={options.includeNumbers}
                        onChange={(e) => updateOption('includeNumbers', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">0-9</span>
                        <p className="text-xs text-gray-500">Números</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={options.includeSymbols}
                        onChange={(e) => updateOption('includeSymbols', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">!@#$%^&*</span>
                        <p className="text-xs text-gray-500">Símbolos especiais</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Opções Avançadas */}
                {showAdvanced && (
                  <div className="border-t border-gray-200 pt-6 space-y-6">
                    <h3 className="text-sm font-medium text-gray-700">Opções Avançadas</h3>
                    
                    {/* Evitar Caracteres Ambíguos */}
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.excludeAmbiguous}
                        onChange={(e) => updateOption('excludeAmbiguous', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Evitar caracteres ambíguos</span>
                        <p className="text-xs text-gray-500">Exclui: 0, O, 1, l, I, |, `</p>
                      </div>
                    </label>

                    {/* Números Mínimos */}
                    {options.includeNumbers && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700">
                            Números Mínimos
                          </label>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {options.minNumbers}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="9"
                          value={options.minNumbers}
                          onChange={(e) => updateOption('minNumbers', parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Símbolos Mínimos */}
                    {options.includeSymbols && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700">
                            Símbolos Mínimos
                          </label>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {options.minSpecial}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="9"
                          value={options.minSpecial}
                          onChange={(e) => updateOption('minSpecial', parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Botão de Ação */}
                <div className="pt-4">
                  <button
                    onClick={handleGenerate}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <Shuffle className="h-5 w-5" />
                    <span>Gerar Nova Senha</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Histórico</h3>
                {history.length > 0 && (
                  <button
                    onClick={exportHistory}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Senhas geradas aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.map((item) => {
                    const itemStrength = getPasswordStrength(item.password)
                    return (
                      <div
                        key={item.id}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium ${itemStrength.textColor}`}>
                            {itemStrength.label}
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.password)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="font-mono text-sm text-gray-700 truncate mb-1">
                          {item.password}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PasswordGeneratorPage 