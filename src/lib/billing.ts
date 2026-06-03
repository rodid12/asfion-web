// Helpers para el panel de admin de cobranzas.
//
// La whitelist de super-admin emails está duplicada en SQL (función
// is_super_admin() en migración 0005) — si sumás alguien al equipo de
// ASFION para que pueda marcar pagos, hay que tocar ambos lugares.

import { supabase } from './supabase';

// === Whitelist ===
//
// Editar acá + en supabase/migrations/0005_subscriptions.sql para sumar
// a alguien al panel de admin.
const SUPER_ADMINS = new Set<string>([
  'rosariodidziulis8@gmail.com',
  'agusufi20@gmail.com',
]);

export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return SUPER_ADMINS.has(email.toLowerCase().trim());
}

// === Tipos ===

export type SubscriptionStatus =
  | 'active' | 'past_due' | 'restricted' | 'suspended' | 'canceled';

export interface ClienteBilling {
  id: string;
  nombre: string;
  subscriptionStatus: SubscriptionStatus;
  periodEndDate: string | null;       // ISO YYYY-MM-DD
  lastPaymentDate: string | null;     // ISO datetime
  billingNotes: string | null;
}

export interface PaymentRow {
  id: string;
  clienteId: string;
  fechaPago: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  metodo: 'transferencia' | 'efectivo' | 'mercadopago' | 'otro';
  cubreHasta: string;
  notas: string | null;
  registradoPor: string;
  createdAt: string;
}

// === Días vencidos ===

export function computeDaysOverdue(periodEndDate: string | null): number {
  if (!periodEndDate) return 0;
  const end = new Date(periodEndDate + 'T23:59:59');
  const diff = Date.now() - end.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// === Sort por urgencia ===
//
// Suspended > restricted > past_due > active > canceled.
// Dentro del mismo status, los más vencidos primero.
const STATUS_URGENCY: Record<SubscriptionStatus, number> = {
  suspended:  4,
  restricted: 3,
  past_due:   2,
  active:     1,
  canceled:   0,
};

export function sortByUrgency(rows: ClienteBilling[]): ClienteBilling[] {
  return [...rows].sort((a, b) => {
    const ua = STATUS_URGENCY[a.subscriptionStatus];
    const ub = STATUS_URGENCY[b.subscriptionStatus];
    if (ua !== ub) return ub - ua;
    const da = computeDaysOverdue(a.periodEndDate);
    const db = computeDaysOverdue(b.periodEndDate);
    if (da !== db) return db - da;
    return a.nombre.localeCompare(b.nombre);
  });
}

// === Queries ===

/** Lee TODOS los clientes con sus estados de billing. Requiere super-admin. */
export async function fetchClientesBilling(): Promise<ClienteBilling[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, subscription_status, period_end_date, last_payment_date, billing_notes')
    .order('nombre');
  if (error) throw new Error(`fetchClientesBilling: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    nombre: r.nombre,
    subscriptionStatus: r.subscription_status as SubscriptionStatus,
    periodEndDate: r.period_end_date,
    lastPaymentDate: r.last_payment_date,
    billingNotes: r.billing_notes,
  }));
}

/** Historial de pagos de un cliente. */
export async function fetchPayments(clienteId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_pago', { ascending: false });
  if (error) throw new Error(`fetchPayments: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    clienteId: r.cliente_id,
    fechaPago: r.fecha_pago,
    monto: Number(r.monto),
    moneda: r.moneda,
    metodo: r.metodo,
    cubreHasta: r.cubre_hasta,
    notas: r.notas,
    registradoPor: r.registrado_por,
    createdAt: r.created_at,
  }));
}

/**
 * Registra un pago. Side effects:
 *   1. INSERT en payments.
 *   2. UPDATE en clientes.period_end_date = cubreHasta.
 *   3. UPDATE en clientes.last_payment_date = now().
 *   4. UPDATE en clientes.subscription_status = 'active'.
 *
 * El cron diario respeta este reset — no vuelve a mover el status hasta que
 * pase el nuevo period_end_date.
 */
export async function registrarPago(params: {
  clienteId: string;
  fechaPago: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  metodo: 'transferencia' | 'efectivo' | 'mercadopago' | 'otro';
  cubreHasta: string;
  notas?: string;
  registradoPor: string;
}): Promise<void> {
  const id = crypto.randomUUID();
  const { error: insertErr } = await supabase.from('payments').insert({
    id,
    cliente_id: params.clienteId,
    fecha_pago: params.fechaPago,
    monto: params.monto,
    moneda: params.moneda,
    metodo: params.metodo,
    cubre_hasta: params.cubreHasta,
    notas: params.notas ?? null,
    registrado_por: params.registradoPor,
  });
  if (insertErr) throw new Error(`registrarPago insert: ${insertErr.message}`);

  const { error: updateErr } = await supabase
    .from('clientes')
    .update({
      period_end_date: params.cubreHasta,
      last_payment_date: new Date().toISOString(),
      subscription_status: 'active',
    })
    .eq('id', params.clienteId);
  if (updateErr) throw new Error(`registrarPago update: ${updateErr.message}`);
}
