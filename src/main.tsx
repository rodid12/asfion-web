import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Cuando Vercel publica una versión nueva, el service worker de la PWA puede
// quedar controlando una pestaña abierta con el JavaScript anterior. Al tomar
// control el worker nuevo recargamos una sola vez para evitar que el dashboard
// siga mostrando cálculos viejos (por ejemplo, stock derivado de tactos).
let reloadingForServiceWorkerUpdate = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForServiceWorkerUpdate) return;
    reloadingForServiceWorkerUpdate = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
