import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { LazyMotion, MotionConfig, MotionGlobalConfig } from 'framer-motion'
import App from './App'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'

// Reduced motion turns every Framer animation off (fades included), not only movement
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const applyReducedMotion = () => { MotionGlobalConfig.skipAnimations = reducedMotion.matches }
applyReducedMotion()
reducedMotion.addEventListener?.('change', applyReducedMotion)

// Components use the small `m` element; the animation code itself loads in its own chunk after
// first paint (strict: a full `motion` element anywhere would throw, so it can't creep back in)
const loadMotionFeatures = () => import('./theme/motionFeatures').then((mod) => mod.default)

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <LazyMotion features={loadMotionFeatures} strict>
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
    </LazyMotion>
  </BrowserRouter>
)
