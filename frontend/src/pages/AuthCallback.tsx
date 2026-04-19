import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // Log da URL completa para debug
    console.log('AuthCallback - URL completa:', window.location.href)
    console.log('AuthCallback - Hash:', window.location.hash)
    
    // Processar o hash da URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const accessToken = hashParams.get('access_token')
    
    // Log dos parâmetros extraídos
    console.log('AuthCallback - Tipo:', type)
    console.log('AuthCallback - Token presente:', !!accessToken)
    console.log('AuthCallback - Todos os parâmetros:', Object.fromEntries(hashParams))
    
    if (type === 'recovery' && accessToken) {
      // Redirecionar para a página de reset com o token
      console.log('AuthCallback - Redirecionando para reset-password')
      navigate(`/reset-password#access_token=${accessToken}&type=${type}`)
    } else if (type === 'signup') {
      // Redirecionar para login após confirmação de email
      console.log('AuthCallback - Redirecionando para login (signup confirmado)')
      navigate('/login?confirmed=true')
    } else if (type === 'magiclink' || type === 'invite') {
      // Login automático via magic link
      console.log('AuthCallback - Redirecionando para dashboard (magiclink/invite)')
      navigate('/dashboard')
    } else {
      // Redirecionar para home em caso de erro
      console.log('AuthCallback - Nenhuma condição atendida, redirecionando para home')
      console.log('AuthCallback - Debug: type =', type, ', accessToken =', !!accessToken)
      navigate('/')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center animate-pulse">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-secondary-900">
          Processando...
        </h2>
        <p className="mt-2 text-secondary-600">
          Você será redirecionado em instantes.
        </p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    </div>
  )
}

export default AuthCallback 