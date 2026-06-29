// =============================================================================
// html.ts — utilidades para construir HTML "a mano" sin riesgo de XSS
// =============================================================================
//
// Cuando interpolamos data del usuario (observaciones, nombres, etc.) en
// template strings que después van a innerHTML o bindPopup de Leaflet,
// `<script>` o `<img onerror>` se ejecutan en sesión de otros usuarios del
// mismo tenant. RLS no salva: el atacante y la víctima comparten cliente.
//
// `escapeHtml` reemplaza los 5 caracteres con significado en HTML por sus
// entidades. Suficiente para texto en contexto de element body o atributo
// con comillas. NO suficiente para URLs (esos requieren su propio escaping).

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tagged template helper — interpola seguro:
 *   safeHtml`<div>${userInput}</div>`
 * Cada `${...}` se escapa automáticamente; los segmentos estáticos del
 * template literal pasan tal cual (porque vienen del código, no del input).
 */
export function safeHtml(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, str, i) => {
    const v = i < values.length ? escapeHtml(values[i] != null ? String(values[i]) : '') : '';
    return acc + str + v;
  }, '');
}
