import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, X, ShieldCheck, Users, PackageCheck, Save, FileImage } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

type DriverApplication = { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; status: string; admin_note: string | null; created_at: string; current_address: string | null; cnic_front_path: string | null; cnic_back_path: string | null; vehicle_plate_image_path: string | null; company_name: string | null }
type DeliveryOrder = { id: string; order_number: string; customer_name: string; customer_phone: string; order_status: string; created_at: string }
type DriverOption = { user_id: string; full_name: string; phone: string; company_name: string | null }
type DriverCustomer = { user_id: string; email: string; full_name: string; phone: string; driver_enabled: boolean }
type DriverAssignment = { assignment_id: string; order_id: string; order_number: string; customer_name: string; driver_user_id: string; driver_name: string; driver_phone: string; assignment_status: string; assigned_at: string; picked_up_at: string | null; delivered_at: string | null; driver_company_name: string | null }

export function DriverManagement() {
  const db = getSupabase() as any
  const [customers, setCustomers] = useState<DriverCustomer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [assignments, setAssignments] = useState<DriverAssignment[]>([])
  const [orderId, setOrderId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setError(null)
    const [settings, apps, orderRows, approved, assignmentRows] = await Promise.all([
      db.rpc('admin_list_driver_customers'),
      db.rpc('admin_list_driver_applications'),
      db.rpc('admin_list_assignable_driver_orders'),
      db.rpc('admin_list_approved_drivers'),
      db.rpc('admin_list_driver_assignments')
    ])
    const failure = settings.error || apps.error || orderRows.error || approved.error || assignmentRows.error
    if (failure) throw new Error(failure.message)
    setCustomers(settings.data ?? [])
    setApplications(apps.data ?? [])
    setOrders(orderRows.data ?? [])
    setDrivers(approved.data ?? [])
    setAssignments(assignmentRows.data ?? [])
    setNotes(Object.fromEntries((apps.data ?? []).map((a: DriverApplication) => [a.id, a.admin_note ?? ''])))
    setCompanyNames(Object.fromEntries((apps.data ?? []).map((a: DriverApplication) => [a.id, a.company_name ?? ''])))
  }

  useEffect(() => { void load().catch(e => setError(e.message || 'Could not load driver operations.')).finally(() => setLoading(false)) }, [])

  async function setCustomerAccess(customer: DriverCustomer) {
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_set_customer_driver_access', { p_user_id: customer.user_id, p_enabled: !customer.driver_enabled })
      if (rpcError) throw rpcError
      setSuccess((customer.full_name || customer.email) + ': driver option ' + (!customer.driver_enabled ? 'enabled' : 'disabled') + '.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not update customer driver access.')
    } finally {
      setBusy(false)
    }
  }

  async function reviewApplication(app: DriverApplication, decision: 'approve' | 'reject' | 'suspend') {
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_review_driver_application', {
        p_application_id: app.id, p_decision: decision, p_admin_note: notes[app.id] ?? null
      })
      if (rpcError) throw rpcError
      setSuccess('Application ' + decision + 'd for ' + app.full_name + '.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not review driver application.')
    } finally {
      setBusy(false)
    }
  }

  async function saveCompanyName(app: DriverApplication) {
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_update_driver_company_name', {
        p_user_id: app.user_id,
        p_company_name: (companyNames[app.id] ?? '').trim() || null
      })
      if (rpcError) throw rpcError
      setSuccess('Company name saved for ' + app.full_name + '.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not save company name.')
    } finally {
      setBusy(false)
    }
  }

  async function openDriverDocument(path: string | null) {
    if (!path) return
    const tab = window.open('about:blank', '_blank')
    try {
      const { data, error: storageError } = await db.storage.from('driver-documents').createSignedUrl(path, 300)
      if (storageError) throw storageError
      if (tab) tab.location.href = data.signedUrl
    } catch (e: any) {
      tab?.close()
      setError(e?.message || 'Could not open driver document.')
    }
  }

  async function assignDriver() {
    if (!orderId || !driverId) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_assign_driver_to_order', {
        p_order_id: orderId, p_driver_user_id: driverId
      })
      if (rpcError) throw rpcError
      setSuccess('Driver assigned successfully.')
      setOrderId(''); setDriverId('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not assign this driver.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelAssignment(assignment: DriverAssignment) {
    if (!window.confirm('Cancel the driver assignment for order ' + assignment.order_number + '? The order will return to the assignable orders list.')) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_cancel_driver_assignment', { p_assignment_id: assignment.assignment_id })
      if (rpcError) throw rpcError
      setSuccess('Driver assignment cancelled. The order is available for reassignment.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not cancel this driver assignment.')
    } finally {
      setBusy(false)
    }
  }

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.trim().toLowerCase()
    return !q || [c.full_name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(q))
  })
  const selected = customers.find(c => c.user_id === selectedCustomer)

  return (
    <main className="admin-content driver-management">
      <div className="admin-page-heading driver-page-heading">
        <div className="driver-heading-copy"><p className="admin-kicker">Delivery operations</p><h2>Driver management</h2><p>Control access, review applications and assign deliveries from one place.</p></div>
        <button className="admin-button admin-button--outline" onClick={() => { setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)) }} disabled={busy || loading}><RefreshCw size={16}/> Refresh</button>
      </div>

      {error && <div className="driver-alert driver-alert--error">{error}</div>}
      {success && <div className="driver-alert driver-alert--success">{success}</div>}

      <section className="admin-panel driver-panel">
        <div className="admin-panel-heading driver-panel-heading"><div><h2>Customer driver access</h2><p>Search for a customer, select their account, then enable or disable the driver option for that customer only.</p></div><Users size={22}/></div>
        <div className="driver-access-fields"><label htmlFor="driver-customer-search">Find customer</label>
        <input id="driver-customer-search" className="driver-control" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search name, email or phone..." />
        <label htmlFor="driver-customer-select">Select customer</label>
        <select id="driver-customer-select" className="driver-control" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
          <option value="">Choose a customer</option>
          {filteredCustomers.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name || 'Customer'} — {c.email}{c.driver_enabled ? ' (Enabled)' : ''}</option>)}
        </select>
        {selected && <div className="driver-customer-access">
          <div><strong>{selected.full_name || 'Customer'}</strong><p>{selected.email} {selected.phone ? `· ${selected.phone}` : ''}</p><span className={selected.driver_enabled ? 'admin-status admin-status--success' : 'admin-status'}>{selected.driver_enabled ? 'Driver access enabled' : 'Driver access disabled'}</span></div>
          <button className={selected.driver_enabled ? 'admin-button admin-button--danger' : 'admin-button'} disabled={busy} onClick={() => void setCustomerAccess(selected)}>{selected.driver_enabled ? 'Disable for this customer' : 'Enable for this customer'}</button>
        </div>}
        {!loading && customers.length === 0 && <p className="driver-empty">No customer accounts were returned.</p>}
        </div>
      </section>

      <section className="admin-panel driver-panel">
        <div className="admin-panel-heading driver-panel-heading"><div><h2>Driver applications</h2><p>Review applications submitted by customers who were given access.</p></div><ShieldCheck size={22}/></div>
        <div className="admin-table-wrap driver-table-wrap"><table className="admin-table driver-table"><thead><tr><th>Applicant</th><th>Address</th><th>Documents</th><th>Vehicle</th><th>Company name (optional)</th><th>Status</th><th>Admin note</th><th>Actions</th></tr></thead>
          <tbody>{applications.map(app => <tr key={app.id}>
            <td><strong>{app.full_name}</strong><br/><small>{app.phone}</small></td>
            <td>{app.current_address || '—'}</td>
            <td className="driver-actions">
              <button className="admin-button admin-button--outline" disabled={!app.cnic_front_path} onClick={() => void openDriverDocument(app.cnic_front_path)}><FileImage size={14}/> CNIC front</button>
              <button className="admin-button admin-button--outline" disabled={!app.cnic_back_path} onClick={() => void openDriverDocument(app.cnic_back_path)}><FileImage size={14}/> CNIC back</button>
              <button className="admin-button admin-button--outline" disabled={!app.vehicle_plate_image_path} onClick={() => void openDriverDocument(app.vehicle_plate_image_path)}><FileImage size={14}/> Number plate</button>
            </td>
            <td>{app.vehicle_type}</td>
            <td><div className="driver-company-field"><input className="driver-control" value={companyNames[app.id] ?? ''} onChange={e => setCompanyNames(v => ({...v,[app.id]:e.target.value}))} placeholder="Optional company name" maxLength={160}/><button className="admin-button admin-button--outline" disabled={busy} onClick={() => void saveCompanyName(app)}><Save size={14}/> Save</button></div></td>
            <td><span className="admin-status">{app.status}</span></td>
            <td><input className="driver-control" value={notes[app.id] ?? ''} onChange={e => setNotes(v => ({...v,[app.id]:e.target.value}))} placeholder="Optional note"/></td>
            <td className="driver-actions">
            <button className="admin-button" disabled={busy || app.status === 'approved'} onClick={() => void reviewApplication(app,'approve')}><Check size={14}/> Approve</button>
            <button className="admin-button admin-button--outline" disabled={busy} onClick={() => void reviewApplication(app,'reject')}><X size={14}/> Reject</button>
            <button className="admin-button admin-button--danger" disabled={busy} onClick={() => void reviewApplication(app,'suspend')}>Suspend</button>
          </td></tr>)}</tbody></table></div>
        {applications.length === 0 && <p className="driver-empty">No driver applications yet.</p>}
      </section>

      <section className="admin-panel driver-panel">
        <div className="admin-section-heading"><div><h2>Assign an order</h2><p>Choose an active customer order and an approved driver.</p></div><PackageCheck size={22}/></div>
        <div className="admin-form-grid driver-assignment-grid">
          <label className="driver-field">Customer order<select className="driver-control" value={orderId} onChange={e => setOrderId(e.target.value)}><option value="">Select an active order</option>{orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.customer_name} ({o.order_status})</option>)}</select></label>
          <label className="driver-field">Approved driver<select className="driver-control" value={driverId} onChange={e => setDriverId(e.target.value)}><option value="">Select a driver</option>{drivers.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name}{d.company_name ? ' · ' + d.company_name : ''} — {d.phone}</option>)}</select></label>
        </div>
        <button className="admin-button" disabled={busy || !orderId || !driverId} onClick={() => void assignDriver()}><Truck size={16}/> Assign driver</button>
      </section>
      <section className="admin-panel driver-panel">
        <div className="admin-section-heading"><div><h2>Driver assignment records</h2><p>Track assigned, picked-up, delivered and cancelled deliveries. Cancel an active assignment to return its order to the available list.</p></div><PackageCheck size={22}/></div>
        <div className="admin-table-wrap driver-table-wrap"><table className="admin-table driver-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Driver</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead>
          <tbody>{assignments.map(a => <tr key={a.assignment_id}>
            <td><strong>{a.order_number}</strong></td><td>{a.customer_name}</td>
            <td><strong>{a.driver_name || 'Driver'}</strong>{a.driver_company_name ? <><br/><small>{a.driver_company_name}</small></> : null}<br/><small>{a.driver_phone}</small></td>
            <td><span className="admin-status">{a.assignment_status.replace('_',' ')}</span></td>
            <td>{new Date(a.assigned_at).toLocaleString()}</td>
            <td>{['assigned','picked_up'].includes(a.assignment_status)
              ? <button className="admin-button admin-button--danger" disabled={busy} onClick={() => void cancelAssignment(a)}><X size={14}/> Cancel assignment</button>
              : <span className="driver-muted">—</span>}</td>
          </tr>)}</tbody>
        </table></div>
        {assignments.length === 0 && <p className="driver-empty">No driver assignments recorded yet.</p>}
      </section>

      {loading && <p>Loading driver operations…</p>}
    </main>
  )
}
