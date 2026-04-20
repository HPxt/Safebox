import React, { useState, useEffect } from 'react'
import { 
  RefreshCw, 
  Copy, 
  Check, 
  Settings,
  Shuffle,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react'

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void
  className?: string
}

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

const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ 
  onPasswordGenerated, 
  className = '' 
}) => {
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
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
    onPasswordGenerated?.(newPassword)
    setCopied(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
    }
  }

  const updateOption = (key: keyof GeneratorOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }

  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: '', color: '' }
    
    let score = 0
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    const levels = [
      { score: 0, label: 'Muito Fraca', color: 'bg-red-500' },
      { score: 1, label: 'Fraca', color: 'bg-red-400' },
      { score: 2, label: 'Fraca', color: 'bg-orange-400' },
      { score: 3, label: 'Média', color: 'bg-yellow-400' },
      { score: 4, label: 'Forte', color: 'bg-blue-400' },
      { score: 5, label: 'Muito Forte', color: 'bg-green-400' },
      { score: 6, label: 'Excelente', color: 'bg-green-500' }
    ]

    return levels[Math.min(score, 6)]
  }

  // Gerar senha inicial
  useEffect(() => {
    handleGenerate()
  }, [options])

  const strength = getPasswordStrength()

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Shield className="h-5 w-5 mr-2 text-blue-600" />
          Gerador de Senhas
        </h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Senha Gerada */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex-1 relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              readOnly
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            onClick={copyToClipboard}
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
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${(strength.score / 6) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600">
              {strength.label}
            </span>
          </div>
        )}
      </div>

      {/* Controles Básicos */}
      <div className="space-y-4 mb-6">
        {/* Comprimento */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Comprimento
            </label>
            <span className="text-sm text-gray-500">{options.length}</span>
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
            <span>128</span>
          </div>
        </div>

        {/* Tipos de Caracteres */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeUppercase}
              onChange={(e) => updateOption('includeUppercase', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">A-Z</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeLowercase}
              onChange={(e) => updateOption('includeLowercase', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">a-z</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeNumbers}
              onChange={(e) => updateOption('includeNumbers', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">0-9</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeSymbols}
              onChange={(e) => updateOption('includeSymbols', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">!@#$%^&*</span>
          </label>
        </div>
      </div>

      {/* Opções Avançadas */}
      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Opções Avançadas</h3>
          
          {/* Evitar Caracteres Ambíguos */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.excludeAmbiguous}
              onChange={(e) => updateOption('excludeAmbiguous', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Evitar caracteres ambíguos</span>
            <span className="text-xs text-gray-400">(0, O, 1, l, I, |)</span>
          </label>

          {/* Números Mínimos */}
          {options.includeNumbers && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Números Mínimos
                </label>
                <span className="text-sm text-gray-500">{options.minNumbers}</span>
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Símbolos Mínimos
                </label>
                <span className="text-sm text-gray-500">{options.minSpecial}</span>
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
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={handleGenerate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <Shuffle className="h-4 w-4" />
          <span>Gerar Nova Senha</span>
        </button>
      </div>
    </div>
  )
}

export default PasswordGenerator 
