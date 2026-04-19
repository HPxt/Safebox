import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, User, Bell, Lock, Database, Settings2 } from 'lucide-react'
import MasterPasswordSettings from '../components/MasterPasswordSettings'
import PreferencesSettings from '../components/PreferencesSettings'
import { useAuth } from '../contexts/AuthContext'

type TabType = 'profile' | 'security' | 'notifications' | 'data' | 'preferences'

const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('security')

  const tabs = [
    { id: 'profile' as TabType, label: 'Perfil', icon: User },
    { id: 'security' as TabType, label: 'Segurança', icon: Shield },
    { id: 'preferences' as TabType, label: 'Preferências', icon: Settings2 },
    { id: 'notifications' as TabType, label: 'Notificações', icon: Bell },
    { id: 'data' as TabType, label: 'Dados', icon: Database },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-50">
      {/* Header */}
      <div className="bg-white dark:bg-dark-100 shadow-sm dark:shadow-dark-200/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-dark-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-900">Configurações</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-dark-100 rounded-lg shadow-sm dark:shadow-dark-200/20 mb-6">
          <div className="border-b border-gray-200 dark:border-dark-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      py-4 px-1 border-b-2 font-medium text-sm flex items-center
                      ${activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-dark-600 hover:text-gray-700 dark:hover:text-dark-800 hover:border-gray-300 dark:hover:border-dark-400'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 mr-2" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-dark-100 rounded-lg shadow-sm dark:shadow-dark-200/20">
          {activeTab === 'profile' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Informações do Perfil
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    Email
                  </label>
                  <p className="text-gray-900 dark:text-dark-900">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-700 mb-1">
                    ID do Usuário
                  </label>
                  <p className="text-gray-500 dark:text-dark-600 text-sm font-mono">{user?.id}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="p-6">
              <MasterPasswordSettings />
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="p-6">
              <PreferencesSettings />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 mb-4 flex items-center">
                <Bell className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Preferências de Notificação
              </h3>
              <p className="text-gray-600 dark:text-dark-700">
                Em breve você poderá configurar suas preferências de notificação aqui.
              </p>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-900 mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Gerenciamento de Dados
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-dark-900 mb-2">Exportar Dados</h4>
                  <p className="text-sm text-gray-600 dark:text-dark-700 mb-3">
                    Baixe todos os seus dados em formato JSON criptografado.
                  </p>
                  <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                    Exportar Dados
                  </button>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">Excluir Conta</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                    Esta ação é permanente e não pode ser desfeita. Todos os seus dados serão excluídos.
                  </p>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings 