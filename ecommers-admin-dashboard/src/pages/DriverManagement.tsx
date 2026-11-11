import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, UserRoundCheck, X, ShieldCheck, Users, PackageCheck } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

type DriverApplication = { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; status: string; admin_note: string | null; created_at: string }
type DeliveryOrder = { id: string; order_number: string; customer_name: string; customer_phone: string; order_status: string; created_at: string }
type DriverOption = { user_id: string; full_name: string; phone: string }

export function DriverManagement() {
  const db = getSupabase() as any
  const [enabled, setEnabled] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [orderId, setOrderId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setError(null)
    const [settings, apps, orderRows, approved] = await Promise.all([
      db.from('store_settings').select('id,driver_system_enabled').limit(1).maybeSingle(),
      db.from('driver_applications').select('id,user_id,full_name,phone,vehicle_type,status,admin_note,created_at').order('created_at', { ascending: false }).limit(200),
      db.from('orders').select('id,order_number,customer_name,customer_phone,order_status,created_at').not('order_status','in','(delivered,cancelled)').order('created_at',{ascending:false}).limit(250),
      db.from('driver_applications').select('user_id,full_name,phone').eq('status','approved').order('full_name')
    ])
    const failure = settings.error || apps.error || orderRows.error || approved.error
    if (failure) throw new Error(failure.message)
    setSettingsId(settings.data?.id ?? null)
    setEnabled(Boolean(settings.data?.driver_system_enabled))
    setApplications(apps.data ?? [])
    setOrders(orderRows.data ?? [])
    setDrivers(approved.data ?? [])
    setNotes(Object.fromEntries((apps.data ?? []).map((a: DriverApplication) => [a.id, a.admin_note ?? ''])))
  }

  useEffect(() => { void load().catch(e => setError(e.message || 'Could not load driver operations.')).finally(() => setLoading(false)) }, [])

  async function toggleSystem() {
    if (!settingsId) return
    setBusy(true); setError(null); setSuccess(null)
    const { error: updateError } = await db.from('store_settings').update({ driver_system_enabled: !enabled }).eq('id', settingsId)
    if (updateError) setError(updateError.message)
    else { setEnabled(!enabled); setSuccess(`Driver system ${!enabled ? 'enabled' : 'disabled'}.`) }
    setBusy(false)
  }

  async function review(app: DriverApplication, decision: 'approved' | 'rejected' | 'suspended') {
    setBusy(true); setError(null); setSuccess(null)
    const { error: rpcError } = await db.rpc('admin_review_driver_application', { p_application_id: app.id, p_decision: decision, p_admin_note: notes[app.id]?.trim() || null })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`${app.full_name}: ${decision}.`); await load() }
    setBusy(false)
  }

  async function assign() {
    if (!orderId || !driverId) return
    setBusy(true); setError(null); setSuccess(null)
    const { error: rpcError } = await db.rpc('admin_assign_driver_to_order', { p_order_id: orderId, p_driver_user_id: driverId })
    if (rpcError) setError(rpcError.message)
    else { setSuccess('Driver assigned to order successfully.'); setOrderId(''); await load() }
    setBusy(false)
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length

  return <section className="driver-management">
    <style>{`
      .driver-management{--dm-ink:#202923;--dm-muted:#707a72;--dm-line:#e8e9e4;--dm-paper:#fff;--dm-bg:#f7f8f5;--dm-accent:#b96e50;color:var(--dm-ink);width:100%;max-width:1500px;margin:0 auto;padding:30px 34px 48px;box-sizing:border-box;font-family:inherit}
      .driver-management *{box-sizing:border-box}.dm-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.dm-eyebrow{display:block;color:#a65e43;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px}.dm-heading h1{font-size:30px;line-height:1.15;letter-spacing:-.035em;margin:0;font-weight:750;color:#202923}.dm-heading p{margin:8px 0 0;color:var(--dm-muted);font-size:14px}.dm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid transparent;border-radius:9px;background:#b96e50;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:.18s}.dm-btn:hover{filter:brightness(.96);transform:translateY(-1px)}.dm-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}.dm-btn--light{background:#fff;border-color:#dedfd9;color:#354039}.dm-btn--danger{background:#fff3f0;color:#a43d2e;border-color:#f1d5ce}.dm-btn--success{background:#e9f4ed;color:#24613c;border-color:#cce4d3}
      .dm-alert{padding:12px 15px;border-radius:9px;font-size:13px;margin:0 0 16px}.dm-alert--error{background:#fff0ee;color:#9c3027;border:1px solid #f2d1cc}.dm-alert--success{background:#edf7ef;color:#28623c;border:1px solid #d3e9d8}
      .dm-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.dm-stat,.dm-card{background:var(--dm-paper);border:1px solid var(--dm-line);border-radius:13px;box-shadow:0 2px 8px rgba(26,39,29,.035)}.dm-stat{padding:17px 19px;display:flex;align-items:center;gap:13px}.dm-stat-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:#f6eee9;color:#a65e43}.dm-stat span{display:block;color:var(--dm-muted);font-size:12px;font-weight:600}.dm-stat strong{display:block;font-size:23px;line-height:1.25;margin-top:3px;letter-spacing:-.03em}
      .dm-card{padding:21px 22px;margin-bottom:17px}.dm-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.dm-card-title{display:flex;align-items:center;gap:10px;margin:0;font-size:17px;font-weight:750;letter-spacing:-.02em}.dm-card-title svg{color:#a65e43}.dm-muted{font-size:13px;color:var(--dm-muted);margin:6px 0 0}.dm-system{display:flex;align-items:center;justify-content:space-between;gap:20px}.dm-system-copy{display:flex;align-items:center;gap:14px}.dm-system-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:#f7eee9;color:#a65e43}.dm-system-copy strong{font-size:15px}.dm-system-copy p{font-size:13px;color:var(--dm-muted);margin:5px 0 0}.dm-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:30px;font-size:11px;font-weight:800;text-transform:capitalize;background:#f0f1ee;color:#626b63}.dm-pill--enabled,.dm-pill--approved,.dm-pill--delivered{background:#e9f5ed;color:#28623d}.dm-pill--pending,.dm-pill--assigned{background:#fff5e6;color:#95611c}.dm-pill--rejected,.dm-pill--suspended,.dm-pill--cancelled{background:#fff0ee;color:#a43d2e}
      .dm-table-wrap{overflow-x:auto;border:1px solid var(--dm-line);border-radius:10px}.dm-table{width:100%;border-collapse:collapse;min-width:850px;text-align:left}.dm-table th{background:#f8f9f6;color:#69736a;font-size:10px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;padding:12px 14px;white-space:nowrap}.dm-table td{padding:14px;border-top:1px solid var(--dm-line);font-size:13px;vertical-align:middle}.dm-table td strong{font-size:13px}.dm-sub{display:block;color:var(--dm-muted);font-size:11px;margin-top:4px}.dm-note{width:100%;min-width:150px;padding:9px 10px;border:1px solid #dedfd9;border-radius:7px;font:inherit;font-size:12px;background:#fff;color:var(--dm-ink)}.dm-note:focus,.dm-select:focus{outline:2px solid #e8c7b8;outline-offset:1px;border-color:#bd8066}.dm-actions{display:flex;gap:6px;flex-wrap:wrap}.dm-actions .dm-btn{min-height:32px;padding:0 10px;font-size:11px;border-radius:7px}
      .dm-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:17px 0}.dm-field{display:flex;flex-direction:column;gap:7px;color:#48534a;font-size:12px;font-weight:700}.dm-select{height:43px;width:100%;padding:0 12px;border:1px solid #dfe2dc;border-radius:8px;background:#fff;color:#273229;font:inherit;font-size:13px;font-weight:500}.dm-empty{padding:27px 15px;text-align:center;color:var(--dm-muted);font-size:13px;background:#fafbf9;border:1px dashed #dfe3dc;border-radius:9px}.dm-empty svg{display:block;margin:0 auto 9px;color:#a4aca4}
      @media(max-width:760px){.driver-management{padding:22px 16px 35px}.dm-heading{align-items:flex-start;flex-direction:column}.dm-heading h1{font-size:25px}.dm-stats{grid-template-columns:1fr}.dm-card{padding:17px 14px}.dm-system{align-items:flex-start;flex-direction:column}.dm-form-grid{grid-template-columns:1fr}.dm-heading>.dm-btn{align-self:stretch}}
    `}</style>
    <header className="dm-heading"><div><span className="dm-eyebrow">Delivery operations</span><h1>Driver management</h1><p>Manage driver applications and assign customer orders.</p></div><button className="dm-btn dm-btn--light" disabled={loading} onClick={() => { setLoading(true); void load().catch(e=>setError(e.message)).finally(()=>setLoading(false)) }}><RefreshCw size={15}/> Refresh</button></header>
    {error && <div className="dm-alert dm-alert--error">{error}</div>}
    {success && <div className="dm-alert dm-alert--success">{success}</div>}
    <div className="dm-stats">
      <div className="dm-stat"><div className="dm-stat-icon"><Users size={20}/></div><div><span>Total applications</span><strong>{applications.length}</strong></div></div>
      <div className="dm-stat"><div className="dm-stat-icon"><UserRoundCheck size={20}/></div><div><span>Pending review</span><strong>{pendingCount}</strong></div></div>
      <div className="dm-stat"><div className="dm-stat-icon"><ShieldCheck size={20}/></div><div><span>Approved drivers</span><strong>{drivers.length}</strong></div></div>
    </div>
    <section className="dm-card"><div className="dm-system"><div className="dm-system-copy"><div className="dm-system-icon"><Truck size={22}/></div><div><strong>Driver system</strong><p>{enabled ? 'Applications and driver operations are currently enabled.' : 'Applications and driver operations are currently disabled.'}</p></div><span className={`dm-pill ${enabled?'dm-pill--enabled':''}`}>{enabled?'Active':'Disabled'}</span></div><button className={`dm-btn ${enabled?'dm-btn--danger':''}`} disabled={busy || !settingsId} onClick={() => void toggleSystem()}>{enabled?'Disable system':'Enable driver system'}</button></div></section>
    <section className="dm-card"><div className="dm-card-head"><h2 className="dm-card-title"><UserRoundCheck size={19}/> Driver applications</h2><span className="dm-pill">{applications.length} total</span></div>
      {loading ? <div className="dm-empty">Loading driver applications…</div> : applications.length === 0 ? <div className="dm-empty"><UserRoundCheck size={24}/>No driver applications yet.</div> : <div className="dm-table-wrap"><table className="dm-table"><thead><tr><th>Applicant</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Admin note</th><th>Review</th></tr></thead><tbody>
      {applications.map(app => <tr key={app.id}><td><strong>{app.full_name}</strong><span className="dm-sub">Applied {new Date(app.created_at).toLocaleDateString()}</span></td><td>{app.phone}</td><td>{app.vehicle_type}</td><td><span className={`dm-pill dm-pill--${app.status}`}>{app.status}</span></td><td><input className="dm-note" value={notes[app.id] ?? ''} onChange={e=>setNotes(old=>({...old,[app.id]:e.target.value}))} placeholder="Add a note"/></td><td><div className="dm-actions"><button className="dm-btn dm-btn--success" disabled={busy || app.status==='approved'} onClick={()=>void review(app,'approved')}><Check size={13}/> Approve</button><button className="dm-btn dm-btn--light" disabled={busy || app.status==='rejected'} onClick={()=>void review(app,'rejected')}><X size={13}/> Reject</button>{app.status==='approved' && <button className="dm-btn dm-btn--danger" disabled={busy} onClick={()=>void review(app,'suspended')}>Suspend</button>}</div></td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="dm-card"><div className="dm-card-head"><h2 className="dm-card-title"><PackageCheck size={19}/> Assign an order</h2></div><p className="dm-muted">Choose an active order and an approved driver to create a delivery assignment.</p><div className="dm-form-grid">
      <label className="dm-field">Customer order<select className="dm-select" value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">Select an active order</option>{orders.map(o=><option key={o.id} value={o.id}>{o.order_number} — {o.customer_name} ({o.order_status})</option>)}</select></label>
      <label className="dm-field">Approved driver<select className="dm-select" value={driverId} onChange={e=>setDriverId(e.target.value)}><option value="">Select a driver</option>{drivers.map(d=><option key={d.user_id} value={d.user_id}>{d.full_name} — {d.phone}</option>)}</select></label>
    </div><button className="dm-btn" disabled={busy || !orderId || !driverId} onClick={()=>void assign()}><Truck size={15}/> Assign driver</button></section>
  </section>
}
