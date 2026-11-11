import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, X, ShieldCheck, Users, PackageCheck } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

type DriverApplication = { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; status: string; admin_note: string | null; created_at: string }
type DeliveryOrder = { id: string; order_number: string; customer_name: string; customer_phone: string; order_status: string; created_at: string }
type DriverOption = { user_id: string; full_name: string; phone: string }
type DriverCustomer = { user_id: string; email: string; full_name: string; phone: string; driver_enabled: boolean }

export function DriverManagement() {
  const db = getSupabase() as any
  const [customers, setCustomers] = useState<DriverCustomer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
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
      db.rpc('admin_list_driver_customers'),
      db.from('driver_applications').select('id,user_id,full_name,phone,vehicle_type,status,admin_note,created_at').order('created_at', { ascending: false }).limit(200),
      db.from('orders').select('id,order_number,customer_name,customer_phone,order_status,created_at').not('order_status','in','(delivered,cancelled)').order('created_at',{ascending:false}).limit(250),
      db.rpc('admin_list_approved_drivers')
    ])
    const failure = settings.error || apps.error || orderRows.error || approved.error
    if (failure) throw new Error(failure.message)
    setCustomers(settings.data ?? [])
    setApplications(apps.data ?? [])
    setOrders(orderRows.data ?? [])
    setDrivers(approved.data ?? [])
    setNotes(Object.fromEntries((apps.data ?? []).map((a: DriverApplication) => [a.id, a.admin_note ?? ''])))
  }

  useEffect(() => { void load().catch(e => setError(e.message || 'Could not load driver operations.')).finally(() => setLoading(false)) }, [])

  async function setCustomerAccess(customer: DriverCustomer) {
    setBusy(true); setError(null); setSuccess(null)
    const { error: rpcError } = await db.rpc('admin_set_customer_driver_access', { p_user_id: customer.user_id, p_enabled: !customer.driver_enabled })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`${customer.full_name || customer.email}: driver option ${!customer.driver_enabled ? 'enabled' : 'disabled'}.`); await load() }
    setBusy(false)
  }

  async function reviewApplication(app: DriverApplication, decision: 'approve' | 'reject' | 'suspend') {
    setBusy(true); setError(null); setSuccess(null)
    const { error: rpcError } = await db.rpc('admin_review_driver_application', {
      p_application_id: app.id, p_decision: decision, p_admin_note: notes[app.id] ?? null
    })
    if (rpcError) setError(rpcError.message)
    else { setSuccess(`Application ${decision}d for ${app.full_name}.`); await load() }
    setBusy(false)
  }

  async function assignDriver() {
    if (!orderId || !driverId) return
    setBusy(true); setError(null); setSuccess(null)
    const { error: rpcError } = await db.rpc('admin_assign_driver_to_order', {
      p_order_id: orderId, p_driver_user_id: driverId
    })
    if (rpcError) setError(rpcError.message)
    else { setSuccess('Driver assigned successfully.'); setOrderId(''); setDriverId(''); await load() }
    setBusy(false)
  }

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.trim().toLowerCase()
    return !q || [c.full_name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(q))
  })
  const selected = customers.find(c => c.user_id === selectedCustomer)

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div><p className="admin-kicker">Delivery operations</p><h1>Driver management</h1><p>Choose exactly which customers can apply to become JTBazar drivers.</p></div>
        <button className="admin-button admin-button--outline" onClick={() => { setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)) }} disabled={busy || loading}><RefreshCw size={16}/> Refresh</button>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      <section className="admin-card" style={{marginBottom:24}}>
        <div className="admin-section-heading"><div><h2>Customer driver access</h2><p>Search for a customer, select their account, then enable or disable the driver option for that customer only.</p></div><Users size={22}/></div>
        <label htmlFor="driver-customer-search">Find customer</label>
        <input id="driver-customer-search" className="admin-input" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search name, email or phone..." />
        <label htmlFor="driver-customer-select">Select customer</label>
        <select id="driver-customer-select" className="admin-select" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
          <option value="">Choose a customer</option>
          {filteredCustomers.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name || 'Customer'} — {c.email}{c.driver_enabled ? ' (Enabled)' : ''}</option>)}
        </select>
        {selected && <div className="admin-customer-access">
          <div><strong>{selected.full_name || 'Customer'}</strong><p>{selected.email} {selected.phone ? `· ${selected.phone}` : ''}</p><span className={selected.driver_enabled ? 'admin-status admin-status--success' : 'admin-status'}>{selected.driver_enabled ? 'Driver access enabled' : 'Driver access disabled'}</span></div>
          <button className={selected.driver_enabled ? 'admin-button admin-button--danger' : 'admin-button'} disabled={busy} onClick={() => void setCustomerAccess(selected)}>{selected.driver_enabled ? 'Disable for this customer' : 'Enable for this customer'}</button>
        </div>}
        {!loading && customers.length === 0 && <p>No customer accounts were returned.</p>}
      </section>

      <section className="admin-card" style={{marginBottom:24}}>
        <div className="admin-section-heading"><div><h2>Driver applications</h2><p>Review applications submitted by customers who were given access.</p></div><ShieldCheck size={22}/></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Applicant</th><th>Vehicle</th><th>Status</th><th>Admin note</th><th>Actions</th></tr></thead>
          <tbody>{applications.map(app => <tr key={app.id}><td><strong>{app.full_name}</strong><br/><small>{app.phone}</small></td><td>{app.vehicle_type}</td><td><span className="admin-status">{app.status}</span></td><td><input className="admin-input" value={notes[app.id] ?? ''} onChange={e => setNotes(v => ({...v,[app.id]:e.target.value}))} placeholder="Optional note"/></td><td className="admin-actions">
            <button className="admin-button" disabled={busy || app.status === 'approved'} onClick={() => void reviewApplication(app,'approve')}><Check size={14}/> Approve</button>
            <button className="admin-button admin-button--outline" disabled={busy} onClick={() => void reviewApplication(app,'reject')}><X size={14}/> Reject</button>
            <button className="admin-button admin-button--danger" disabled={busy} onClick={() => void reviewApplication(app,'suspend')}>Suspend</button>
          </td></tr>)}</tbody></table></div>
        {applications.length === 0 && <p>No driver applications yet.</p>}
      </section>

      <section className="admin-card">
        <div className="admin-section-heading"><div><h2>Assign an order</h2><p>Choose an active customer order and an approved driver.</p></div><PackageCheck size={22}/></div>
        <div className="admin-form-grid">
          <label>Customer order<select className="admin-select" value={orderId} onChange={e => setOrderId(e.target.value)}><option value="">Select an active order</option>{orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.customer_name} ({o.order_status})</option>)}</select></label>
          <label>Approved driver<select className="admin-select" value={driverId} onChange={e => setDriverId(e.target.value)}><option value="">Select a driver</option>{drivers.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name} — {d.phone}</option>)}</select></label>
        </div>
        <button className="admin-button" disabled={busy || !orderId || !driverId} onClick={() => void assignDriver()}><Truck size={16}/> Assign driver</button>
      </section>
      {loading && <p>Loading driver operations…</p>}
    </main>
  )
}
