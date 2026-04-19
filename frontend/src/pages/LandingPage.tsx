import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, 
  Lock, 
  Zap, 
  Eye, 
  Folder, 
  RefreshCw,
  Check,
  ArrowRight,
  Key,
  Smartphone,
  Globe,
  ChevronRight,
  Star
} from 'lucide-react'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const footerActionClassName = 'hover:text-white transition-colors'
  const handleFooterPlaceholderClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const benefits = [
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Argon2id + AES-256-GCM",
      description: "Derivação de chave resistente a ataques com criptografia militar de última geração"
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Acesso Instantâneo",
      description: "Suas senhas sempre à mão, em qualquer dispositivo, a qualquer momento"
    },
    {
      icon: <Eye className="h-8 w-8" />,
      title: "Zero Knowledge",
      description: "Nem mesmo nós temos acesso às suas senhas. Sua privacidade é absoluta"
    }
  ]

  const steps = [
    {
      number: "01",
      title: "Crie sua conta",
      description: "Cadastre-se em segundos com apenas seu email"
    },
    {
      number: "02",
      title: "Adicione suas senhas",
      description: "Importe ou cadastre suas credenciais com segurança"
    },
    {
      number: "03",
      title: "Acesse de qualquer lugar",
      description: "Suas senhas sincronizadas em todos os dispositivos"
    }
  ]

  const features = [
    {
      icon: <Key className="h-6 w-6" />,
      title: "Gerador de Senhas",
      description: "Crie senhas fortes e únicas com um clique"
    },
    {
      icon: <Folder className="h-6 w-6" />,
      title: "Organização Inteligente",
      description: "Organize suas senhas em pastas personalizadas"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Autenticação 2FA",
      description: "Dupla camada de segurança para sua conta"
    },
    {
      icon: <RefreshCw className="h-6 w-6" />,
      title: "Sincronização em Tempo Real",
      description: "Mudanças instantâneas em todos os dispositivos"
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "Acesso Mobile",
      description: "Interface otimizada para smartphones"
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Acesso Web Seguro",
      description: "Use de qualquer navegador com HTTPS"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md fixed top-0 w-full z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-2xl font-bold text-gray-900">SafeBox</span>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex space-x-8">
                <a href="#benefits" className="text-gray-600 hover:text-blue-600 transition-colors">Benefícios</a>
                <a href="#how-it-works" className="text-gray-600 hover:text-blue-600 transition-colors">Como Funciona</a>
                <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Recursos</a>
                <a href="#security" className="text-gray-600 hover:text-blue-600 transition-colors">Segurança</a>
              </nav>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate('/login')}
                  className="text-gray-700 border border-gray-300 px-5 py-2 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors font-medium"
                >
                  Entrar
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Começar Grátis
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              Suas senhas protegidas com
              <span className="text-blue-600"> criptografia militar</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Nunca mais esqueça uma senha. Armazene todas as suas credenciais com segurança 
              em um único lugar e acesse de qualquer dispositivo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium flex items-center justify-center"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="bg-white text-gray-700 px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium border border-gray-300"
              >
                Já tenho conta
              </button>
            </div>
          </div>
          
          {/* Hero Image/Illustration */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 sm:p-12">
              <div className="bg-white rounded-xl shadow-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Minhas Credenciais</h3>
                  <Lock className="h-6 w-6 text-green-500" />
                </div>
                <div className="space-y-4">
                  {['Netflix', 'GitHub', 'Gmail'].map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Key className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{service}</p>
                          <p className="text-sm text-gray-500">••••••••</p>
                        </div>
                      </div>
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o SafeBox?
            </h2>
            <p className="text-xl text-gray-600">
              Segurança de ponta com a praticidade que você merece
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-8 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full mb-4">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Como funciona?
            </h2>
            <p className="text-xl text-gray-600">
              Comece a proteger suas senhas em 3 passos simples
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gray-300 -translate-x-1/2 z-0">
                    <ChevronRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 bg-gray-50" />
                  </div>
                )}
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-600 text-white rounded-full mb-4 text-2xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Recursos poderosos para sua segurança
            </h2>
            <p className="text-xl text-gray-600">
              Tudo que você precisa para gerenciar suas senhas com eficiência
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-6 bg-gray-50 rounded-xl hover:shadow-lg transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-lg mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Segurança é nossa prioridade #1
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Derivação de Chave com Argon2id</h3>
                    <p className="text-gray-600">Algoritmo vencedor da Password Hashing Competition, resistente a ataques de força bruta e rainbow tables</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Criptografia AES-256-GCM</h3>
                    <p className="text-gray-600">Padrão militar de criptografia com autenticação integrada, garantindo confidencialidade e integridade</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Salt e Nonce Únicos</h3>
                    <p className="text-gray-600">Cada usuário tem seu salt único e cada operação usa um nonce diferente, impossibilitando ataques de repetição</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Arquitetura Zero-Knowledge</h3>
                    <p className="text-gray-600">Sua senha-mestra nunca sai do seu dispositivo. Nem nós podemos acessar seus dados</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Conformidade LGPD</h3>
                    <p className="text-gray-600">Totalmente adequado às leis de proteção de dados brasileiras e internacionais</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <div className="text-center">
                <Shield className="h-24 w-24 text-blue-600 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Tecnologias de Segurança</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <Key className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Argon2id</p>
                    <p className="text-xs text-gray-500">64MB, 3 iterações</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">AES-256-GCM</p>
                    <p className="text-xs text-gray-500">Criptografia autenticada</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <Lock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">PBKDF2</p>
                    <p className="text-xs text-gray-500">Backup seguro</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <Star className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">WebCrypto API</p>
                    <p className="text-xs text-gray-500">Nativo do navegador</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Proteja suas senhas hoje mesmo
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Junte-se a milhares de usuários que já protegem suas senhas com o SafeBox
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors text-lg font-medium inline-flex items-center"
          >
            Criar Conta Gratuita
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
          <p className="text-blue-100 mt-4">
            Não é necessário cartão de crédito
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Shield className="h-8 w-8 text-blue-400 mr-2" />
                <span className="text-xl font-bold text-white">SafeBox</span>
              </div>
              <p className="text-sm">
                O gerenciador de senhas mais seguro e prático do mercado.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Recursos</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Segurança</a></li>
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Preços</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Sobre</button></li>
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Blog</button></li>
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Contato</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Privacidade</button></li>
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>Termos</button></li>
                <li><button type="button" onClick={handleFooterPlaceholderClick} className={footerActionClassName}>LGPD</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 SafeBox. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage 
