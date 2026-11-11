import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, UserRoundCheck, X } from 'lucide-react'
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
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
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
  }

  useEffect(() => { void load().catch(e => setError(e.message || 'Could not load driver operations.')) }, [])

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
    const { error: rpcError } = await db.rpc('admin_review_driver_application', { p_application_id: app.id, p_decision: decision, p_admin_note: note.trim() || null })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`${app.full_name}: ${decision}.`); setNote(''); await load() }
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

  return <section className="admin-page">
    <div className="admin-page-heading"><div><span className="admin-kicker">DELIVERY OPERATIONS</span><h2>Driver management</h2><p>Internal JTBazar drivers, applications and order assignments.</p></div><button className="admin-button admin-button--outline" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="admin-alert admin-alert--error">{error}</div>}
    {success && <div className="admin-alert admin-alert--success">{success}</div>}
    <div className="admin-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
      <div><strong>Driver system</strong><p>{enabled ? 'Applications and driver operations are enabled.' : 'Driver applications and operations are disabled.'}</p></div>
      <button className={`admin-button ${enabled ? 'admin-button--danger' : ''}`} disabled={busy || !settingsId} onClick={() => void toggleSystem()}>{enabled ? 'Disable driver system' : 'Enable driver system'}</button>
    </div>
    <div className="admin-card"><h3><UserRoundCheck size={18}/> Driver applications ({applications.length})</h3>
      {applications.length === 0 ? <p>No driver applications yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Applicant</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Admin note</th><th>Actions</th></tr></thead><tbody>
      {applications.map(app => <tr key={app.id}><td><strong>{app.full_name}</strong><small>{new Date(app.created_at).toLocaleDateString()}</small></td><td>{app.phone}</td><td>{app.vehicle_type}</td><td><span className={`admin-status admin-status--${app.status}`}>{app.status}</span></td><td><input value={note} onChange={e=>setNote(e.target.value)} placeholder={app.admin_note || 'Optional note'} aria-label={`Admin note for ${app.full_name}`}/></td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button className="admin-button" disabled={busy} onClick={()=>void review(app,'approved')}><Check size={14}/> Approve</button><button className="admin-button admin-button--outline" disabled={busy} onClick={()=>void review(app,'rejected')}><X size={14}/> Reject</button>{app.status==='approved' && <button className="admin-button admin-button--danger" disabled={busy} onClick={()=>void review(app,'suspended')}>Suspend</button>}</div></td></tr>)}
      </tbody></table></div>}
    </div>
    <div className="admin-card"><h3><Truck size={18}/> Assign an order</h3><p>Only approved drivers can receive active orders.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <label>Order<select value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">Select active order</option>{orders.map(o=><option key={o.id} value={o.id}>{o.order_number} — {o.customer_name} ({o.order_status})</option>)}</select></label>
      <label>Approved driver<select value={driverId} onChange={e=>setDriverId(e.target.value)}><option value="">Select driver</option>{drivers.map(d=><option key={d.user_id} value={d.user_id}>{d.full_name} — {d.phone}</option>)}</select></label>
    </div><button className="admin-button" disabled={busy || !orderId || !driverId} onClick={()=>void assign()}>Assign driver</button></div>
  </section>
}
