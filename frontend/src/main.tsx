import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/overview.css'
import App from './App'
import './styles.css'
import './brand.css'
import './interaction-effects.css'
import { installInteractionEffects } from './interaction-effects'

const disposeEffects = installInteractionEffects()
import.meta.hot?.dispose(disposeEffects)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
