import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PreferencesProvider } from './contexts/PreferencesContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import FoldersView from './pages/FoldersView'
import PasswordGeneratorPage from './pages/PasswordGenerator'
import LandingPage from './pages/LandingPage'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
import Settings from './pages/Settings'
import HiddenCredentials from './pages/HiddenCredentials'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PreferencesProvider>
          <Router>
            <div className="App min-h-screen bg-white dark:bg-dark-50 text-gray-900 dark:text-dark-900 transition-colors duration-300">
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/folders" 
                element={
                  <ProtectedRoute>
                    <FoldersView />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/generator" 
                element={
                  <ProtectedRoute>
                    <PasswordGeneratorPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/hidden" 
                element={
                  <ProtectedRoute>
                    <HiddenCredentials />
                  </ProtectedRoute>
                } 
              />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </PreferencesProvider>
    </AuthProvider>
  </ThemeProvider>
  )
}

export default App
