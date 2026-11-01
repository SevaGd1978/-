import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './auth'
import { DataProvider } from './store'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Не найден корневой элемент')

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
)
