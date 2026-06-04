// Logo oficial del brand — wordmark naranja + (navy | blanco) sobre fondo
// transparente. Dos variantes:
//
//   variant="default" → "ASF" en navy + "iON" en orange. Para usar sobre
//                       fondos blancos / claros (login card, MissingEnv card,
//                       splash con fondo claro, etc.).
//   variant="onDark"  → "ASF" en blanco + "iON" en orange. Para usar sobre
//                       fondos oscuros como el header navyDeep del Dashboard
//                       o la pantalla de carga con fondo navy.
//
// Los SVG viven en /public/ (estáticos servidos por Vite) — los referenciamos
// como <img src> para no inflar el bundle JS.
//
// Si en el futuro hace falta una variante monocromática (todo blanco para
// dark mode estricto o todo navy para reverse), creamos un asfion-logo-mono.svg
// análogo y sumamos otra clave al MAP de abajo.

import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'onDark';

const SRC_BY_VARIANT: Record<Variant, string> = {
  default: '/asfion-logo.svg',
  onDark:  '/asfion-logo-on-dark.svg',
};

interface Props {
  /** Alto en píxeles — el ancho se ajusta solo respetando el aspect ratio. */
  height?: number;
  /** "default" para fondos claros, "onDark" para fondos navy/negros. */
  variant?: Variant;
  className?: string;
}

export function Logo({ height = 36, variant = 'default', className }: Props) {
  return (
    <img
      src={SRC_BY_VARIANT[variant]}
      alt="ASFION"
      style={{ height }}
      className={cn('w-auto select-none', className)}
      draggable={false}
    />
  );
}
