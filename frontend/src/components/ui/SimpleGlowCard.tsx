import React from 'react'

interface SimpleGlowCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
  intensity?: 'low' | 'medium' | 'high'
}

const SimpleGlowCard: React.FC<SimpleGlowCardProps> = ({
  children,
  className = '',
  glowColor = 'blue',
  intensity = 'medium'
}) => {
  const getGlowClasses = () => {
    const baseClasses = 'transition-all duration-300 hover:shadow-lg'
    
    const glowStyles = {
      blue: 'hover:shadow-blue-500/25',
      green: 'hover:shadow-green-500/25', 
      red: 'hover:shadow-red-500/25',
      purple: 'hover:shadow-purple-500/25',
      orange: 'hover:shadow-orange-500/25'
    }

    const intensityStyles = {
      low: 'hover:shadow-md',
      medium: 'hover:shadow-lg',
      high: 'hover:shadow-xl'
    }

    return `${baseClasses} ${glowStyles[glowColor]} ${intensityStyles[intensity]}`
  }

  return (
    <div className={`
      bg-white dark:bg-gray-800 
      rounded-xl p-6 
      border border-gray-200 dark:border-gray-700 
      ${getGlowClasses()} 
      ${className}
    `}>
      {children}
    </div>
  )
}

export default SimpleGlowCard 