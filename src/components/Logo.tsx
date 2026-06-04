// Logo oficial del brand — wordmark navy + naranja sobre fondo transparente.
//
// El SVG vive en /public/asfion-logo.svg con viewBox 1920×673 (aspect ratio
// ~2.85:1). Acá lo embebemos como <img> referenciando el path público, así
// Vite lo sirve estático sin pasarlo por el bundler.
//
// Uso típico:
//   <Logo height={32} />           → header del Dashboard
//   <Logo height={48} className="mb-3" /> → pantalla de login centrada

import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Alto en píxeles — el ancho se ajusta solo respetando el aspect ratio. */
  height?: number;
  className?: string;
}

export function Logo({ height = 36, className }: Props) {
  return (
    <img
      src="/asfion-logo.svg"
      alt="ASFION"
      style={{ height }}
      className={cn('w-auto select-none', className)}
      draggable={false}
    />
  );
}
