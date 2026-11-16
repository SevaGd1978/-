import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '../auth'
import { DataProvider } from '../store'
import { ManagerApp } from './ManagerApp'
import '../mobile/android-base.css'
import './manager.css'

const root = document.getElementById('manager-root')
if (!root) throw new Error('Не найден корневой элемент менеджера')

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <ManagerApp />
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
)
