// BillingAdminPage — panel de administración de cobranzas.
//
// Solo visible para super-admin (ver isSuperAdmin en lib/billing.ts).
// Listado de TODOS los clientes ordenados por urgencia (suspended primero),
// con su estado de subscription, días vencidos, último pago y un CTA para
// marcar un pago recibido.

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2Icon, ClockIcon, RefreshCwIcon, XCircleIcon } from 'lucide-react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { kpiValueClass, KPI_VALUE_BASE, kpiTitleAttr } from '@/lib/kpiSize';
import { dateAISO } from '@/lib/fechas';
import { useAuth } from '@/lib/auth';
import {
  computeDaysOverdue,
  fetchClientesBilling,
  registrarPago,
  sortByUrgency,
  type ClienteBilling,
  type SubscriptionStatus,
} from '@/lib/billing';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active:     'Al día',
  past_due:   'Vencido',
  restricted: 'En mora',
  suspended:  'Suspendido',
  canceled:   'Cancelado',
};

const STATUS_CLS: Record<SubscriptionStatus, string> = {
  active:     'bg-asfion-success/15 text-asfion-success',
  past_due:   'bg-asfion-orange/20 text-asfion-orange',
  restricted: 'bg-asfion-terracota/20 text-asfion-terracota',
  suspended:  'bg-asfion-danger/15 text-asfion-danger',
  canceled:   'bg-asfion-muted/20 text-asfion-muted',
};

export function BillingAdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ClienteBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ClienteBilling | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientesBilling();
      setRows(sortByUrgency(data));
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const t = { active: 0, past_due: 0, restricted: 0, suspended: 0, canceled: 0 };
    for (const r of rows) t[r.subscriptionStatus]++;
    return t;
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin de cobranzas"
        subtitle="Listado de clientes y estado de pago. Marcá pagos recibidos cuando llegue la transferencia."
        count={{ value: rows.length, label: 'clientes' }}
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-asfion-navy text-white hover:bg-asfion-navyDeep disabled:opacity-40 transition"
          >
            <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} />
            Refrescar
          </button>
        }
      />

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatusTile label="Al día"      n={totals.active}     accent="success" />
        <StatusTile label="Vencidos"    n={totals.past_due}   accent="orange" />
        <StatusTile label="En mora"     n={totals.restricted} accent="terracota" />
        <StatusTile label="Suspendidos" n={totals.suspended}  accent="danger" />
        <StatusTile label="Cancelados"  n={totals.canceled}   accent="muted" />
      </div>

      {error && (
        <div className="rounded-xl border border-asfion-danger/30 bg-asfion-danger/10 px-4 py-3 text-sm text-asfion-danger">
          {error}
        </div>
      )}

      <Card title="Clientes" subtitle="Ordenados por urgencia (suspendidos primero)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                <th className="py-3 px-2 font-semibold">Cliente</th>
                <th className="py-3 px-2 font-semibold">Estado</th>
                <th className="py-3 px-2 font-semibold">Vence</th>
                <th className="py-3 px-2 font-semibold tabular-nums">Días vencido</th>
                <th className="py-3 px-2 font-semibold">Último pago</th>
                <th className="py-3 px-2 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const days = computeDaysOverdue(r.periodEndDate);
                return (
                  <tr key={r.id} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
                    <td className="py-3 px-2 font-semibold text-asfion-navyDeep">{r.nombre}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_CLS[r.subscriptionStatus]}`}>
                        {STATUS_LABEL[r.subscriptionStatus]}
                      </span>
                    </td>
                    <td className="py-3 px-2 tabular-nums text-asfion-navy">
                      {r.periodEndDate ?? '—'}
                    </td>
                    <td className="py-3 px-2 tabular-nums">
                      {days > 0 ? (
                        <span className="text-asfion-danger font-bold">{days}d</span>
                      ) : (
                        <span className="text-asfion-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 tabular-nums text-asfion-muted">
                      {r.lastPaymentDate ? r.lastPaymentDate.slice(0, 10) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => setPaymentTarget(r)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-asfion-orange text-white hover:opacity-90 transition whitespace-nowrap"
                      >
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-asfion-muted italic">
                    No hay clientes cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {paymentTarget && (
        <RegistrarPagoModal
          cliente={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={async () => {
            setPaymentTarget(null);
            await load();
          }}
          adminEmail={user?.email ?? ''}
        />
      )}
    </div>
  );
}

function StatusTile({
  label, n, accent,
}: {
  label: string;
  n: number;
  accent: 'success' | 'orange' | 'terracota' | 'danger' | 'muted';
}) {
  const cls =
    accent === 'success'   ? 'text-asfion-success' :
    accent === 'orange'    ? 'text-asfion-orange' :
    accent === 'terracota' ? 'text-asfion-terracota' :
    accent === 'danger'    ? 'text-asfion-danger' :
                             'text-asfion-muted';
  // Tamaño adaptativo del número — comparte regla con Kpi/MiniKpi para
  // que un total como "$15.234.567" no rompa el tile.
  const valueStr = String(n);
  return (
    <div className="bg-white rounded-xl border border-asfion-borderSoft px-4 py-3 min-w-0 overflow-hidden">
      <p
        className={`${kpiValueClass(valueStr, 'mini')} ${KPI_VALUE_BASE} ${cls}`}
        title={kpiTitleAttr(valueStr)}
      >
        {n}
      </p>
      <p className="text-xs uppercase tracking-wide font-semibold text-asfion-muted leading-tight">{label}</p>
    </div>
  );
}

// === Modal: registrar pago ===

function RegistrarPagoModal({
  cliente, onClose, onSaved, adminEmail,
}: {
  cliente: ClienteBilling;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  adminEmail: string;
}) {
  // Defaults razonables: pago hoy, cubre 30 días después del period_end_date
  // anterior (o desde hoy si no había). El admin puede sobreescribir.
  //
  // dateAISO (zona local): antes toISOString() corría fechaPago un día
  // si el admin registraba después de las 21:00 ART (audit 27-jun-2026).
  const today = dateAISO(new Date());
  const baseDate = cliente.periodEndDate
    ? new Date(cliente.periodEndDate + 'T00:00:00')
    : new Date();
  const defaultCubreHasta = new Date(baseDate);
  defaultCubreHasta.setDate(defaultCubreHasta.getDate() + 30);
  const defaultCubreHastaStr = dateAISO(defaultCubreHasta);

  const [fechaPago, setFechaPago] = useState(today);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [metodo, setMetodo] = useState<'transferencia' | 'efectivo' | 'mercadopago' | 'otro'>('transferencia');
  const [cubreHasta, setCubreHasta] = useState(defaultCubreHastaStr);
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || Number(monto) <= 0) {
      setError('Ingresá un monto válido.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registrarPago({
        clienteId: cliente.id,
        fechaPago,
        monto: Number(monto),
        moneda,
        metodo,
        cubreHasta,
        notas: notas.trim() || undefined,
        registradoPor: adminEmail,
      });
      await onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Error al registrar el pago');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-asfion-navyDeep/60 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl my-auto max-h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-asfion-borderSoft sticky top-0 bg-white z-10">
          <h3 className="text-lg font-extrabold text-asfion-navyDeep">Registrar pago</h3>
          <p className="text-sm text-asfion-muted mt-1">
            Cliente: <span className="font-semibold text-asfion-navy">{cliente.nombre}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Fecha de pago">
            <input
              type="date"
              value={fechaPago}
              onChange={e => setFechaPago(e.target.value)}
              className={INPUT_CLS}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                className={INPUT_CLS}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Moneda">
              <select value={moneda} onChange={e => setMoneda(e.target.value as 'ARS' | 'USD')} className={INPUT_CLS}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>

          <Field label="Método">
            <select value={metodo} onChange={e => setMetodo(e.target.value as any)} className={INPUT_CLS}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="otro">Otro</option>
            </select>
          </Field>

          <Field label="Cubre hasta (nuevo vencimiento)">
            <input
              type="date"
              value={cubreHasta}
              onChange={e => setCubreHasta(e.target.value)}
              className={INPUT_CLS}
              required
            />
            <p className="text-xs text-asfion-muted mt-1">
              El status del cliente vuelve a "activo" y se vence de nuevo en esta fecha.
            </p>
          </Field>

          <Field label="Notas (opcional)">
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className={INPUT_CLS}
              rows={2}
              placeholder="Ej: pagó 2 meses adelantados"
            />
          </Field>

          {error && (
            <div className="text-sm text-asfion-danger bg-asfion-danger/10 border border-asfion-danger/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-asfion-navy hover:bg-asfion-bg transition"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-asfion-orange text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {submitting ? 'Guardando…' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg border border-asfion-borderSoft focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-asfion-muted">{label}</label>
      {children}
    </div>
  );
}

// Re-exports for clarity if other files want the icons (currently unused).
export { CheckCircle2Icon, ClockIcon, XCircleIcon };
