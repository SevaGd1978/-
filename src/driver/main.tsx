import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DriverApp } from './DriverApp'
import '../mobile/android-base.css'
import './driver.css'

const root = document.getElementById('driver-root')
if (!root) throw new Error('Не найден корневой элемент водителя')

createRoot(root).render(
  <StrictMode>
    <DriverApp />
  </StrictMode>,
)
