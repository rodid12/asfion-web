// Panel de administración de clientes (super-admin only).
//
// Sin esta pantalla, onboardear un cliente nuevo requería:
//   1. Editar y aplicar SQL a mano en Supabase Editor (~30 min)
//   2. Crear el row en `clientes` con catálogos JSON correctos
//   3. INSERTAR cada campo en `campos`
//   4. Crear los usuarios en `auth.users` + tabla `usuarios`
//
// Con este panel se hace todo desde la UI sin escribir SQL. La RLS de
// migration 0015 garantiza que solo emails listados en is_super_admin()
// pueden ejecutar los inserts/updates.

import React, { useEffect, useState } from 'react';
import { PlusIcon, RefreshCwIcon, ArrowLeftIcon, AlertTriangleIcon, XIcon } from 'lucide-react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import {
  adminListClientes,
  adminCreateCliente,
  adminListCampos,
  adminCreateCampo,
  adminDeleteCampo,
  adminListUsuarios,
  adminInviteUsuario,
  adminDeleteUsuario,
  adminReenviarMagicLink,
  type ClienteAdminRow,
  type CampoAdminRow,
  type UsuarioAdminRow,
  type RolUsuario,
} from '@/data/admin';

// =============================================================================
// Defaults para nuevos clientes — basados en los catálogos del piloto.
// El admin después los puede ajustar editando el row en la DB. Para una
// próxima iteración: hacer estos catálogos editables desde la UI.
// =============================================================================

const CATALOGOS_DEFAULT = {
  pariciones: {
    vacasGrupos: ['Vacas cabeza', 'Vaca cuerpo', 'Vaca cola'],
    eventos: ['Nacimiento', 'Muerte', 'Aborto', 'Retacto'],
    sexos: ['Macho', 'Hembra', 'Orejano'],
    asistencia: ['Si', 'No'],
    caravanaColores: ['Celeste', 'Amarillo', 'Blanca', 'Naranja'],
    causaTipos: ['Muerte Señalado', 'Nacido Muerto', 'Desconocido'],
    causasFrecuentes: ['Insolación', 'Diarrea', 'Calor', 'Picadura de víbora'],
  },
  mortandad: {
    categorias: ['Vc Preñ', 'TernM', 'TernH', 'Vaq 1° Servicio', 'Vaq 2° Servicio', 'Novillito', 'Novillo', 'Toros'],
    actividades: ['Cria', 'engorde', 'Recria P', 'Invernada', 'Destete Precoz'],
    causaTipos: ['Muerte Señalado', 'Nacido Muerto', 'Desconocido'],
  },
  pastoreo: {
    categorias: ['Novillito Grande', 'Novillito Mediano', 'Novillito Chico', 'Vaquilla Grande', 'Vaquilla Mediana', 'Vaquilla Chica'],
    eventos: ['Entrada', 'Salida', 'Rotacion', 'Muerte'],
    catAnimal: ['Vc preñ', 'Toros', 'TernH', 'TernM', 'Novillo', 'Novillito'],
  },
  compras: {
    actividades: ['Destete Precoz', 'Engorde', 'Invernada'],
    plazos: ['Contado', '30 días', '60 días', '90 días'],
  },
};

const MODULOS_DISPONIBLES = [
  { key: 'pariciones', label: 'Pariciones' },
  { key: 'lluvias',    label: 'Lluvias'    },
  { key: 'mortandad',  label: 'Mortandad'  },
  { key: 'pastoreo',   label: 'Pastoreo'   },
  { key: 'compras',    label: 'Compras'    },
  { key: 'ventas',     label: 'Ventas'     },
];

// =============================================================================
// Componente principal
// =============================================================================

export function ClientesAdminPage() {
  const [clientes, setClientes] = useState<ClienteAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [modalCreate, setModalCreate] = useState(false);

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await adminListClientes();
      setClientes(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  // Vista detalle de un cliente seleccionado
  if (seleccionado) {
    const cliente = clientes.find(c => c.id === seleccionado);
    if (!cliente) {
      return (
        <div className="space-y-4">
          <button onClick={() => setSeleccionado(null)} className="text-sm text-asfion-orange flex items-center gap-1">
            <ArrowLeftIcon size={14} /> Volver
          </button>
          <p className="text-asfion-danger">Cliente no encontrado.</p>
        </div>
      );
    }
    return (
      <ClienteDetalle cliente={cliente} onVolver={() => setSeleccionado(null)} />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gestión multi-tenant — crear y configurar instalaciones nuevas."
        count={{ value: clientes.length, label: 'clientes' }}
        actions={
          <div className="flex gap-2">
            <button
              onClick={reload}
              disabled={loading}
              className="p-2 rounded-lg text-asfion-muted hover:bg-asfion-bg transition disabled:opacity-40"
              title="Recargar"
            >
              <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setModalCreate(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-asfion-orange text-white hover:opacity-90"
            >
              <PlusIcon size={14} /> Nuevo cliente
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-asfion-danger/30 bg-asfion-danger/10 px-4 py-3 text-sm text-asfion-danger flex items-center gap-2">
          <AlertTriangleIcon size={16} /> {error}
        </div>
      )}

      <Card title="Lista de clientes" subtitle="Click en un cliente para ver sus campos">
        {loading && clientes.length === 0 ? (
          <p className="text-sm text-asfion-muted py-8 text-center italic">Cargando…</p>
        ) : clientes.length === 0 ? (
          <p className="text-sm text-asfion-muted py-8 text-center italic">No hay clientes — creá el primero con "Nuevo cliente".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                  <th className="py-2 px-2 font-semibold">ID</th>
                  <th className="py-2 px-2 font-semibold">Nombre</th>
                  <th className="py-2 px-2 font-semibold">Tagline</th>
                  <th className="py-2 px-2 font-semibold">Módulos</th>
                  <th className="py-2 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSeleccionado(c.id)}
                    className="border-b border-asfion-borderSoft/50 hover:bg-asfion-orangeSoft/20 cursor-pointer transition"
                  >
                    <td className="py-3 px-2 font-mono text-xs text-asfion-muted">{c.id}</td>
                    <td className="py-3 px-2 font-bold text-asfion-navyDeep">{c.nombre}</td>
                    <td className="py-3 px-2 text-asfion-muted">{c.tagline ?? '—'}</td>
                    <td className="py-3 px-2 text-xs">
                      <span className="text-asfion-muted">{c.modulos_habilitados.length} módulos</span>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ' +
                          (c.subscription_status === 'active'
                            ? 'bg-asfion-orange/20 text-asfion-navyDeep'
                            : 'bg-asfion-terracota/20 text-asfion-terracota')
                        }
                      >
                        {c.subscription_status ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalCreate && (
        <CreateClienteModal
          onClose={() => setModalCreate(false)}
          onCreated={() => { setModalCreate(false); void reload(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Modal: Crear cliente
// =============================================================================

function CreateClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [tagline, setTagline] = useState('');
  const [modulos, setModulos] = useState<string[]>(['pariciones', 'lluvias', 'mortandad', 'pastoreo']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModulo = (key: string) => {
    setModulos(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
  };

  // Auto-genera el slug a partir del nombre cuando el id está vacío.
  const onNombreChange = (v: string) => {
    setNombre(v);
    if (!id) {
      const slug = v.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setId(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminCreateCliente({
        id,
        nombre,
        tagline: tagline.trim() || undefined,
        modulosHabilitados: modulos,
        catalogos: CATALOGOS_DEFAULT,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-asfion-navyDeep/60 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl my-auto max-h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-asfion-borderSoft sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-asfion-navyDeep">Nuevo cliente</h3>
          <button onClick={onClose} className="p-1 text-asfion-muted hover:text-asfion-navyDeep">
            <XIcon size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={e => onNombreChange(e.target.value)}
              placeholder="Estancia Las Margaritas"
              className={INPUT_CLS}
              required
            />
          </Field>
          <Field label="ID (slug)">
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="estancia-las-margaritas"
              className={INPUT_CLS}
              required
              pattern="^[a-z0-9-]+$"
            />
            <p className="text-[11px] text-asfion-muted mt-1">
              Solo minúsculas, números y guiones. No se puede cambiar después.
            </p>
          </Field>
          <Field label="Tagline (opcional)">
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="Cabaña Hereford"
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Módulos habilitados">
            <div className="grid grid-cols-2 gap-2">
              {MODULOS_DISPONIBLES.map(m => (
                <label
                  key={m.key}
                  className={
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ' +
                    (modulos.includes(m.key)
                      ? 'border-asfion-orange bg-asfion-orangeSoft/30'
                      : 'border-asfion-borderSoft hover:bg-asfion-bg/60')
                  }
                >
                  <input
                    type="checkbox"
                    checked={modulos.includes(m.key)}
                    onChange={() => toggleModulo(m.key)}
                    className="accent-asfion-orange"
                  />
                  <span className="text-sm font-semibold text-asfion-navy">{m.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <div className="bg-asfion-bg/60 rounded-lg p-3 text-xs text-asfion-muted">
            <strong className="text-asfion-navy">Catálogos por defecto:</strong> al crear, se inicializan
            con los del piloto Ganaderas (categorías, eventos, sexos, etc.). Después se pueden ajustar
            por SQL hasta que tengamos editor de catálogos en la UI.
          </div>

          {error && (
            <p className="text-sm text-asfion-danger flex items-center gap-2">
              <AlertTriangleIcon size={14} /> {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg border border-asfion-borderSoft text-sm font-semibold text-asfion-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !id || !nombre}
              className="flex-1 px-3 py-2 rounded-lg bg-asfion-orange text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Vista detalle de un cliente
// =============================================================================

function ClienteDetalle({ cliente, onVolver }: { cliente: ClienteAdminRow; onVolver: () => void }) {
  const [campos, setCampos] = useState<CampoAdminRow[]>([]);
  const [loadingCampos, setLoadingCampos] = useState(true);
  const [modalCampo, setModalCampo] = useState(false);

  const reloadCampos = async () => {
    try {
      setLoadingCampos(true);
      const rows = await adminListCampos(cliente.id);
      setCampos(rows);
    } catch (e) {
      console.error('reloadCampos', e);
    } finally {
      setLoadingCampos(false);
    }
  };

  useEffect(() => { void reloadCampos(); }, [cliente.id]);

  const onDeleteCampo = async (id: string) => {
    if (!confirm(`¿Borrar campo "${id}"?`)) return;
    try {
      await adminDeleteCampo(id);
      await reloadCampos();
    } catch (e: any) {
      alert(e?.message ?? 'Error al borrar');
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onVolver} className="text-sm text-asfion-orange flex items-center gap-1 font-semibold">
        <ArrowLeftIcon size={14} /> Volver a la lista
      </button>

      <PageHeader
        title={cliente.nombre}
        subtitle={cliente.tagline ?? cliente.id}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-white border border-asfion-borderSoft rounded-lg p-3">
          <p className="text-[10px] uppercase font-semibold text-asfion-muted">ID</p>
          <p className="font-mono text-xs text-asfion-navy mt-1">{cliente.id}</p>
        </div>
        <div className="bg-white border border-asfion-borderSoft rounded-lg p-3">
          <p className="text-[10px] uppercase font-semibold text-asfion-muted">Status</p>
          <p className="font-bold text-asfion-navyDeep mt-1">{cliente.subscription_status ?? '—'}</p>
        </div>
        <div className="bg-white border border-asfion-borderSoft rounded-lg p-3">
          <p className="text-[10px] uppercase font-semibold text-asfion-muted">Módulos</p>
          <p className="text-xs text-asfion-navy mt-1">{cliente.modulos_habilitados.join(', ') || '—'}</p>
        </div>
      </div>

      <Card
        title="Campos"
        subtitle={`${campos.length} campos cargados`}
        actions={
          <button
            onClick={() => setModalCampo(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-asfion-orange text-white hover:opacity-90"
          >
            <PlusIcon size={12} /> Nuevo campo
          </button>
        }
      >
        {loadingCampos ? (
          <p className="text-sm text-asfion-muted py-6 text-center italic">Cargando…</p>
        ) : campos.length === 0 ? (
          <p className="text-sm text-asfion-muted py-6 text-center italic">
            No hay campos. Agregá el primero con "Nuevo campo".
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                <th className="py-2 px-2 font-semibold">ID</th>
                <th className="py-2 px-2 font-semibold">Nombre</th>
                <th className="py-2 px-2 font-semibold text-right">Stock inicial</th>
                <th className="py-2 px-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campos.map(c => (
                <tr key={c.id} className="border-b border-asfion-borderSoft/50">
                  <td className="py-2 px-2 font-mono text-xs text-asfion-muted">{c.id}</td>
                  <td className="py-2 px-2 font-semibold text-asfion-navy">{c.nombre}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.stock_inicial_vacas ?? '—'}</td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => onDeleteCampo(c.id)}
                      className="text-xs text-asfion-danger hover:underline"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Usuarios — invite vía magic link */}
      <UsuariosSection clienteId={cliente.id} campos={campos} />

      {modalCampo && (
        <CreateCampoModal
          clienteId={cliente.id}
          onClose={() => setModalCampo(false)}
          onCreated={() => { setModalCampo(false); void reloadCampos(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Sección Usuarios — lista + invite + delete
// =============================================================================

function UsuariosSection({ clienteId, campos }: { clienteId: string; campos: CampoAdminRow[] }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const reload = async () => {
    try {
      setLoading(true);
      const rows = await adminListUsuarios(clienteId);
      setUsuarios(rows);
    } catch (e) {
      console.error('adminListUsuarios', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [clienteId]);

  const onDelete = async (email: string) => {
    if (!confirm(
      `¿Quitar acceso a "${email}"?\n\n` +
      `El usuario queda en auth pero sin cliente — no podrá entrar al dashboard.\n` +
      `Hard-delete del auth.user requiere Supabase Console.`,
    )) return;
    try {
      setBusyEmail(email);
      await adminDeleteUsuario(email);
      await reload();
    } catch (e: any) {
      alert(e?.message ?? 'Error al borrar usuario');
    } finally {
      setBusyEmail(null);
    }
  };

  const onReenviar = async (email: string) => {
    try {
      setBusyEmail(email);
      await adminReenviarMagicLink(email);
      alert(`Magic link reenviado a ${email}. Revisá su casilla (puede caer en spam).`);
    } catch (e: any) {
      alert(e?.message ?? 'Error al reenviar el link');
    } finally {
      setBusyEmail(null);
    }
  };

  const campoNombre = (id?: string | null) =>
    id ? (campos.find(c => c.id === id)?.nombre ?? id) : '—';

  return (
    <Card
      title="Usuarios"
      subtitle={`${usuarios.length} usuarios con acceso a este cliente`}
      actions={
        <button
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-asfion-orange text-white hover:opacity-90"
        >
          <PlusIcon size={12} /> Invitar usuario
        </button>
      }
    >
      {loading ? (
        <p className="text-sm text-asfion-muted py-6 text-center italic">Cargando…</p>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-asfion-muted py-6 text-center italic">
          Sin usuarios. Invitá al primero — recibe magic link por email para entrar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                <th className="py-2 px-2 font-semibold">Email</th>
                <th className="py-2 px-2 font-semibold">Nombre</th>
                <th className="py-2 px-2 font-semibold">Rol</th>
                <th className="py-2 px-2 font-semibold">Campo asignado</th>
                <th className="py-2 px-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const nombreCompleto = [u.nombre, u.apellido].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={u.email} className="border-b border-asfion-borderSoft/50">
                    <td className="py-2 px-2 font-mono text-xs text-asfion-navyDeep">{u.email}</td>
                    <td className="py-2 px-2 text-asfion-navy">{nombreCompleto}</td>
                    <td className="py-2 px-2">
                      <span className={
                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ' +
                        (u.rol === 'administrador'
                          ? 'bg-asfion-orange/20 text-asfion-navyDeep'
                          : u.rol === 'moderador'
                            ? 'bg-asfion-orangeSoft/40 text-asfion-navyDeep'
                            : 'bg-asfion-borderSoft text-asfion-muted')
                      }>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-asfion-muted">{campoNombre(u.campo_asignado_id)}</td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => onReenviar(u.email)}
                        disabled={busyEmail === u.email}
                        className="text-xs text-asfion-orange hover:underline mr-3 disabled:opacity-40"
                      >
                        Reenviar link
                      </button>
                      <button
                        onClick={() => onDelete(u.email)}
                        disabled={busyEmail === u.email}
                        className="text-xs text-asfion-danger hover:underline disabled:opacity-40"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <InviteUsuarioModal
          clienteId={clienteId}
          campos={campos}
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); void reload(); }}
        />
      )}
    </Card>
  );
}

// =============================================================================
// Modal: invitar usuario
// =============================================================================

function InviteUsuarioModal({
  clienteId, campos, onClose, onCreated,
}: {
  clienteId: string;
  campos: CampoAdminRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rol, setRol] = useState<RolUsuario>('operario');
  const [campoAsignadoId, setCampoAsignadoId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminInviteUsuario({
        email,
        clienteId,
        rol,
        nombre: nombre.trim() || undefined,
        apellido: apellido.trim() || undefined,
        campoAsignadoId: campoAsignadoId || null,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Error al invitar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-asfion-navyDeep/60 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl my-auto max-h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-asfion-borderSoft sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-asfion-navyDeep">Invitar usuario</h3>
          <button onClick={onClose} className="p-1 text-asfion-muted hover:text-asfion-navyDeep">
            <XIcon size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="operario@ejemplo.com"
              className={INPUT_CLS}
              required
              autoFocus
            />
            <p className="text-[11px] text-asfion-muted mt-1">
              Recibe un link mágico por email para entrar — sin necesidad de password.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Juan"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Apellido">
              <input
                type="text"
                value={apellido}
                onChange={e => setApellido(e.target.value)}
                placeholder="Pérez"
                className={INPUT_CLS}
              />
            </Field>
          </div>

          <Field label="Rol">
            <div className="grid grid-cols-3 gap-2">
              {(['administrador', 'moderador', 'operario'] as const).map(r => (
                <label
                  key={r}
                  className={
                    'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border cursor-pointer transition text-xs font-semibold capitalize ' +
                    (rol === r
                      ? 'border-asfion-orange bg-asfion-orangeSoft/30 text-asfion-navyDeep'
                      : 'border-asfion-borderSoft text-asfion-muted hover:bg-asfion-bg/60')
                  }
                >
                  <input
                    type="radio"
                    name="rol"
                    checked={rol === r}
                    onChange={() => setRol(r)}
                    className="sr-only"
                  />
                  {r}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-asfion-muted mt-1">
              <strong>Operario</strong>: solo carga eventos. <strong>Moderador</strong>: ve todos los campos.
              <strong> Administrador</strong>: edita todo.
            </p>
          </Field>

          <Field label="Campo asignado (opcional)">
            <select
              value={campoAsignadoId}
              onChange={e => setCampoAsignadoId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— Ningún campo por default —</option>
              {campos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <p className="text-[11px] text-asfion-muted mt-1">
              Se preselecciona este campo cuando el operario carga eventos en la app.
            </p>
          </Field>

          {error && (
            <p className="text-sm text-asfion-danger flex items-center gap-2">
              <AlertTriangleIcon size={14} /> {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg border border-asfion-borderSoft text-sm font-semibold text-asfion-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !email}
              className="flex-1 px-3 py-2 rounded-lg bg-asfion-orange text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Modal: Crear campo
// =============================================================================

function CreateCampoModal({
  clienteId, onClose, onCreated,
}: {
  clienteId: string; onClose: () => void; onCreated: () => void;
}) {
  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [stock, setStock] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNombreChange = (v: string) => {
    setNombre(v);
    if (!id) {
      const slug = v.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setId(`campo-${slug}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminCreateCampo({
        id,
        clienteId,
        nombre,
        stockInicialVacas: stock.trim() ? parseInt(stock, 10) : undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-asfion-navyDeep/60 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl my-auto max-h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-asfion-borderSoft sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-asfion-navyDeep">Nuevo campo</h3>
          <button onClick={onClose} className="p-1 text-asfion-muted hover:text-asfion-navyDeep">
            <XIcon size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={e => onNombreChange(e.target.value)}
              placeholder="Carolina"
              className={INPUT_CLS}
              required
            />
          </Field>
          <Field label="ID">
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="campo-carolina"
              className={INPUT_CLS}
              required
              pattern="^[a-z0-9-]+$"
            />
          </Field>
          <Field label="Stock inicial de vacas (opcional)">
            <input
              type="number"
              value={stock}
              onChange={e => setStock(e.target.value)}
              placeholder="438"
              className={INPUT_CLS}
              min="0"
            />
            <p className="text-[11px] text-asfion-muted mt-1">
              Cantidad de vacas preñadas al inicio. Se usa para % Parición.
            </p>
          </Field>

          {error && (
            <p className="text-sm text-asfion-danger flex items-center gap-2">
              <AlertTriangleIcon size={14} /> {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg border border-asfion-borderSoft text-sm font-semibold text-asfion-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !id || !nombre}
              className="flex-1 px-3 py-2 rounded-lg bg-asfion-orange text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creando…' : 'Crear campo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers de UI compartidos
// =============================================================================

const INPUT_CLS =
  'w-full bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-2 text-sm text-asfion-navyDeep ' +
  'focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-asfion-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
