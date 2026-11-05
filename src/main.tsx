import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { clearAllDashboardCaches } from './data/offlineCache';

// No recargamos ni revalidamos el dashboard al perder/recuperar foco. Las
// versiones nuevas de la PWA quedan esperando y se activan al cerrar la
// pestaña; durante el trabajo diario los datos solo se actualizan mediante el
// botón Refrescar o al abrir una nueva sesión de la página.

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
