import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { MotionConfig } from 'framer-motion'
import App from './App'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <MotionConfig reducedMotion="user">
    <ThemeProvider>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'rgb(var(--ink))',
              color: 'rgb(var(--ground))',
              borderRadius: '999px',
              padding: '10px 18px',
              fontFamily: 'Archivo, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#1E8E4E', secondary: '#fff' } },
            error: { iconTheme: { primary: '#C81E1E', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
    </MotionConfig>
  </BrowserRouter>
)
