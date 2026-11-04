import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { clearAllDashboardCaches } from './data/offlineCache';

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

  // Verificamos una versión nueva al abrir ASFION, nunca al recuperar foco.
  // Así una pestaña que quedó abierta recibe el siguiente deployment sin
  // volver a sincronizar cada vez que el usuario cambia de aplicación.
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistration().then(registration => registration?.update());
  }, { once: true });
}

async function recoverStaleMobileVersion(): Promise<boolean> {
  const url = new URL(window.location.href);
  if (url.searchParams.get('actualizar') !== '1') return false;

  // Conservamos el login. Solo quitamos el snapshot del dashboard y los
  // archivos estáticos controlados por un service worker anterior.
  await clearAllDashboardCaches();
  if ('caches' in window) {
    const names = await window.caches.keys();
    await Promise.all(names.map(name => window.caches.delete(name)));
  }
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  url.searchParams.delete('actualizar');
  window.location.replace(url.toString());
  return true;
}

void recoverStaleMobileVersion().then(reloading => {
  if (reloading) return;
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
