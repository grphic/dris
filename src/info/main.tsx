import { createRoot } from 'react-dom/client'
import '../theme.css'
import './info.css'
import { InfoApp } from './InfoApp'

createRoot(document.getElementById('root')!).render(<InfoApp />)
