import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode disabled: double-mount breaks Phaser canvas initialization
createRoot(document.getElementById('root')!).render(<App />)
