import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Design system tokens — must be first
import '../../src/styles/tokens.css'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
