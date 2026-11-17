import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, X, ShieldCheck, Users, PackageCheck, Save, FileImage } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

type DriverApplication = { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; status: string; admin_note: string | null; created_at: string; current_address: string | null; cnic_front_path: string | null; cnic_back_path: string | null; vehicle_plate_image_path: string | null; company_name: string | null }
type DeliveryOrder = { id: string; order_number: string; customer_name: string; customer_phone: string; order_status: string; created_at: string }
type DriverOption = { user_id: string; full_name: string; phone: string; company_name: string | null }
type DriverCustomer = { user_id: string; email: string; full_name: string; phone: string; driver_enabled: boolean }
type DriverAssignment = { assignment_id: string; order_id: string; order_number: string; customer_name: string; driver_user_id: string; driver_name: string; driver_phone: string; assignment_status: string; assigned_at: string; picked_up_at: string | null; delivered_at: string | null; driver_company_name: string | null; failed_reason: string | null; failed_note: string | null; delivery_batch_number: string | null; delivery_proof_path: string | null; cod_collected_amount: number | null; cash_reconciled_amount: number | null }
type DriverBatch = { batch_id: string; batch_number: string; customer_id: string; customer_name: string; customer_phone: string; order_count: number; delivery_fee: number }
type DriverCashRow = { assignment_id: string; order_id: string; order_number: string; customer_name: string; driver_user_id: string; driver_name: string; payment_method: string; order_total: number; collected_amount: number | null; reconciled_amount: number | null; reconciled_at: string | null; reconciliation_note: string | null; delivered_at: string | null }

export function DriverManagement() {
  const db = getSupabase() as any
  const [customers, setCustomers] = useState<DriverCustomer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [assignments, setAssignments] = useState<DriverAssignment[]>([])
  const [batches, setBatches] = useState<DriverBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [cashRows, setCashRows] = useState<DriverCashRow[]>([])
  const [orderId, setOrderId] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [driverId, setDriverId] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'deliveries' | 'drivers' | 'cash'>('deliveries')

  async function load() {
    setError(null)
    const [settings, apps, orderRows, approved, assignmentRows, batchRows, cashResults] = await Promise.all([
      db.rpc('admin_list_driver_customers'),
      db.rpc('admin_list_driver_applications'),
      db.rpc('admin_list_assignable_driver_orders'),
      db.rpc('admin_list_approved_drivers'),
      db.rpc('admin_list_driver_assignments_v2'),
      db.rpc('admin_list_assignable_delivery_batches'),
      db.rpc('admin_list_driver_cash_reconciliation')
    ])
    const failure = settings.error || apps.error || orderRows.error || approved.error || assignmentRows.error || batchRows.error || cashResults.error
    if (failure) throw new Error(failure.message)
    setCustomers(settings.data ?? [])
    setApplications(apps.data ?? [])
    setOrders(orderRows.data ?? [])
    setDrivers(approved.data ?? [])
    setAssignments(assignmentRows.data ?? [])
    setBatches(batchRows.data ?? [])
    setCashRows(cashResults.data ?? [])
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

  async function createCombinedBatch() {
    if (selectedOrderIds.length < 2) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { data, error: rpcError } = await db.rpc('admin_create_combined_driver_batch', { p_order_ids: selectedOrderIds })
      if (rpcError) throw rpcError
      setSuccess('Combined delivery batch created. Existing order delivery fees were preserved. Select a driver below to assign it.')
      setSelectedOrderIds([])
      await load()
      if (data) setSelectedBatchId(String(data))
    } catch (e: any) { setError(e?.message || 'Could not create the combined delivery batch.') }
    finally { setBusy(false) }
  }

  async function assignBatch() {
    if (!selectedBatchId || !driverId) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { data, error: rpcError } = await db.rpc('admin_assign_driver_to_delivery_batch', { p_batch_id: selectedBatchId, p_driver_user_id: driverId })
      if (rpcError) throw rpcError
      setSuccess(`${Number(data ?? 0)} orders assigned together to the selected driver.`)
      setSelectedBatchId(''); setDriverId('')
      await load()
    } catch (e: any) { setError(e?.message || 'Could not assign this delivery batch.') }
    finally { setBusy(false) }
  }

  async function reconcileCash(row: DriverCashRow) {
    const rawAmount = window.prompt(`Cash received from ${row.driver_name} for ${row.order_number}. Driver recorded: PKR ${Number(row.collected_amount ?? 0).toLocaleString()}. Enter the cash amount received:`)
    if (rawAmount === null) return
    const amount = Number(rawAmount.replace(/,/g, '').trim())
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid non-negative cash amount.'); return }
    const note = amount !== Number(row.collected_amount ?? 0) ? window.prompt('Amount differs from driver record. Add a reconciliation note (required):') : window.prompt('Optional reconciliation note:')
    if (note === null) return
    if (amount !== Number(row.collected_amount ?? 0) && !note.trim()) { setError('A note is required when the cash amount differs.'); return }
    setBusy(true); setError(null); setSuccess(null)
    try {
      const { error: rpcError } = await db.rpc('admin_reconcile_driver_cash', { p_assignment_id: row.assignment_id, p_amount: amount, p_note: note.trim() || null })
      if (rpcError) throw rpcError
      setSuccess(`Cash reconciliation saved for ${row.order_number}.`)
      await load()
    } catch (e: any) { setError(e?.message || 'Could not reconcile driver cash.') }
    finally { setBusy(false) }
  }

  async function openDeliveryProof(row: DriverCashRow) {
    const tab = window.open('about:blank', '_blank')
    try {
      const { data: path, error: rpcError } = await db.rpc('admin_get_driver_delivery_proof_path', { p_assignment_id: row.assignment_id })
      if (rpcError) throw rpcError
      if (!path) throw new Error('No delivery photo proof was uploaded for this order.')
      const { data, error: storageError } = await db.storage.from('driver-documents').createSignedUrl(path, 300)
      if (storageError) throw storageError
      if (tab) tab.location.href = data.signedUrl
    } catch (e: any) {
      tab?.close()
      setError(e?.message || 'Could not open delivery proof.')
    }
  }

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.trim().toLowerCase()
    return !q || [c.full_name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(q))
  })
  const selected = customers.find(c => c.user_id === selectedCustomer)
  const filteredOrders = orders.filter(o => {
    const q = orderSearch.trim().toLowerCase()
    return !q || o.order_number.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
  })

  return (
    <main className="admin-content driver-management">
      <div className="admin-page-heading driver-page-heading">
        <div className="driver-heading-copy">
          <p className="admin-kicker">Delivery operations</p>
          <h2>Delivery control center</h2>
          <p>Manage drivers, send orders for delivery and check COD cash — all from one simple screen.</p>
        </div>
        <button className="admin-button admin-button--outline" onClick={() => { setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)) }} disabled={busy || loading}><RefreshCw size={16}/> Refresh</button>
      </div>

      {error && <div className="driver-alert driver-alert--error">{error}</div>}
      {success && <div className="driver-alert driver-alert--success">{success}</div>}

      <div className="driver-simple-tabs" role="tablist" aria-label="Delivery sections">
        <button type="button" className={activeTab === 'deliveries' ? 'is-active' : ''} onClick={() => setActiveTab('deliveries')}><Truck size={16}/> Deliveries <span>{orders.length}</span></button>
        <button type="button" className={activeTab === 'drivers' ? 'is-active' : ''} onClick={() => setActiveTab('drivers')}><Users size={16}/> Drivers <span>{applications.length}</span></button>
        <button type="button" className={activeTab === 'cash' ? 'is-active' : ''} onClick={() => setActiveTab('cash')}><ShieldCheck size={16}/> COD cash <span>{cashRows.filter(r => !r.reconciled_at && r.collected_amount != null).length}</span></button>
      </div>

      {activeTab === 'deliveries' && <>
        <section className="admin-panel driver-panel driver-simple-panel">
          <div className="admin-panel-heading driver-panel-heading"><div><h2>Assign a delivery</h2><p>Choose an order and an approved driver. Only eligible confirmed orders appear here.</p></div><PackageCheck size={22}/></div>
          <div className="admin-form-grid driver-assignment-grid">
            <label className="driver-field">Find order
              <input className="driver-control" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Order number or ID"/>
            </label>
            <label className="driver-field">Order
              <select className="driver-control" value={orderId} onChange={e => setOrderId(e.target.value)}>
                <option value="">Select an order ({filteredOrders.length} available)</option>
                {filteredOrders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.customer_name}</option>)}
              </select>
            </label>
            <label className="driver-field">Driver
              <select className="driver-control" value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">Select approved driver</option>
                {drivers.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name} — {d.phone}</option>)}
              </select>
            </label>
          </div>
          <button className="admin-button" disabled={busy || !orderId || !driverId} onClick={() => void assignDriver()}><Truck size={16}/> Assign delivery</button>
          {orders.length === 0 && <p className="driver-empty">No confirmed orders are ready for driver assignment.</p>}
          {orders.length > 0 && filteredOrders.length === 0 && <p className="driver-empty">No orders match your search.</p>}
        </section>

        <section className="admin-panel driver-panel driver-simple-panel">
          <div className="admin-section-heading"><div><h2>Delivery tracking</h2><p>See which driver has each order and its latest status.</p></div><PackageCheck size={22}/></div>
          <div className="admin-table-wrap driver-table-wrap"><table className="admin-table driver-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Driver</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead>
            <tbody>{assignments.map(a => <tr key={a.assignment_id}>
              <td><strong>{a.order_number}</strong>{a.delivery_batch_number ? <><br/><small>{a.delivery_batch_number}</small></> : null}</td>
              <td>{a.customer_name}</td>
              <td><strong>{a.driver_name || 'Driver'}</strong><br/><small>{a.driver_phone}</small></td>
              <td><span className="admin-status">{a.assignment_status.replaceAll('_',' ')}</span>{a.failed_reason ? <small><br/>{a.failed_reason.replaceAll('_',' ')}{a.failed_note ? ' — ' + a.failed_note : ''}</small> : null}</td>
              <td>{new Date(a.assigned_at).toLocaleDateString()}</td>
              <td>{['assigned','picked_up'].includes(a.assignment_status) ? <button className="admin-button admin-button--danger" disabled={busy} onClick={() => void cancelAssignment(a)}><X size={14}/> Cancel</button> : <span className="driver-muted">—</span>}</td>
            </tr>)}</tbody>
          </table></div>
          {assignments.length === 0 && <p className="driver-empty">No deliveries assigned yet.</p>}
        </section>

        <details className="admin-panel driver-panel driver-advanced">
          <summary><span><strong>Advanced: combine multiple orders</strong><small>Use only when the same customer has orders going to the exact same address.</small></span><PackageCheck size={18}/></summary>
          <div className="driver-advanced-content">
            <p className="driver-muted">Select two or more orders for one customer. The system checks the saved address before creating a batch.</p>
            <div className="driver-batch-order-list">
              {filteredOrders.map(o => <label key={o.id}><input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={e => setSelectedOrderIds(current => e.target.checked ? [...current,o.id] : current.filter(id => id !== o.id))}/><span><strong>{o.order_number}</strong> · {o.customer_name}</span></label>)}
            </div>
            <button className="admin-button" disabled={busy || selectedOrderIds.length < 2} onClick={() => void createCombinedBatch()}><PackageCheck size={16}/> Create batch ({selectedOrderIds.length} selected)</button>
            <div className="admin-form-grid driver-assignment-grid" style={{marginTop:16}}>
              <label className="driver-field">Ready batch<select className="driver-control" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}><option value="">Select a batch</option>{batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.batch_number} · {b.customer_name} · {b.order_count} orders</option>)}</select></label>
              <label className="driver-field">Approved driver<select className="driver-control" value={driverId} onChange={e => setDriverId(e.target.value)}><option value="">Select a driver</option>{drivers.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name} — {d.phone}</option>)}</select></label>
            </div>
            <button className="admin-button" disabled={busy || !selectedBatchId || !driverId} onClick={() => void assignBatch()}><Truck size={16}/> Assign batch</button>
            {batches.length === 0 && <p className="driver-empty">No ready combined batches.</p>}
          </div>
        </details>
      </>}

      {activeTab === 'drivers' && <>
        <section className="admin-panel driver-panel driver-simple-panel">
          <div className="admin-panel-heading driver-panel-heading"><div><h2>Give a customer driver access</h2><p>Search a customer and enable or disable driver applications for that account.</p></div><Users size={22}/></div>
          <div className="driver-access-fields">
            <label htmlFor="driver-customer-search">Search customer</label>
            <input id="driver-customer-search" className="driver-control" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Name, email or phone"/>
            <label htmlFor="driver-customer-select">Choose customer</label>
            <select id="driver-customer-select" className="driver-control" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
              <option value="">Select customer</option>{filteredCustomers.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name || 'Customer'} — {c.email}{c.driver_enabled ? ' (Enabled)' : ''}</option>)}
            </select>
            {selected && <div className="driver-customer-access"><div><strong>{selected.full_name || 'Customer'}</strong><p>{selected.email}{selected.phone ? ' · ' + selected.phone : ''}</p><span className={selected.driver_enabled ? 'admin-status admin-status--success' : 'admin-status'}>{selected.driver_enabled ? 'Driver access enabled' : 'Driver access disabled'}</span></div><button className={selected.driver_enabled ? 'admin-button admin-button--danger' : 'admin-button'} disabled={busy} onClick={() => void setCustomerAccess(selected)}>{selected.driver_enabled ? 'Disable access' : 'Enable access'}</button></div>}
          </div>
        </section>
        <section className="admin-panel driver-panel driver-simple-panel">
          <div className="admin-panel-heading driver-panel-heading"><div><h2>Driver applications</h2><p>Review documents and approve, reject or suspend applicants.</p></div><ShieldCheck size={22}/></div>
          <div className="admin-table-wrap driver-table-wrap"><table className="admin-table driver-table"><thead><tr><th>Applicant</th><th>Address</th><th>Documents</th><th>Vehicle</th><th>Company</th><th>Status & review</th></tr></thead>
            <tbody>{applications.map(app => <tr key={app.id}>
              <td><strong>{app.full_name}</strong><br/><small>{app.phone}</small></td>
              <td>{app.current_address || '—'}</td>
              <td className="driver-actions"><button className="admin-button admin-button--outline" disabled={!app.cnic_front_path} onClick={() => void openDriverDocument(app.cnic_front_path)}>CNIC front</button><button className="admin-button admin-button--outline" disabled={!app.cnic_back_path} onClick={() => void openDriverDocument(app.cnic_back_path)}>CNIC back</button><button className="admin-button admin-button--outline" disabled={!app.vehicle_plate_image_path} onClick={() => void openDriverDocument(app.vehicle_plate_image_path)}>Number plate</button></td>
              <td>{app.vehicle_type}</td>
              <td><div className="driver-company-field"><input className="driver-control" value={companyNames[app.id] ?? ''} onChange={e => setCompanyNames(v => ({...v,[app.id]:e.target.value}))} placeholder="Optional" maxLength={160}/><button className="admin-button admin-button--outline" disabled={busy} onClick={() => void saveCompanyName(app)}><Save size={14}/> Save</button></div></td>
              <td><span className="admin-status">{app.status}</span><input className="driver-control" style={{marginTop:8}} value={notes[app.id] ?? ''} onChange={e => setNotes(v => ({...v,[app.id]:e.target.value}))} placeholder="Admin note (optional)"/><div className="driver-review-actions"><button className="admin-button" disabled={busy || app.status === 'approved'} onClick={() => void reviewApplication(app,'approve')}><Check size={14}/> Approve</button><button className="admin-button admin-button--outline" disabled={busy} onClick={() => void reviewApplication(app,'reject')}><X size={14}/> Reject</button><button className="admin-button admin-button--danger" disabled={busy} onClick={() => void reviewApplication(app,'suspend')}>Suspend</button></div></td>
            </tr>)}</tbody></table></div>
          {applications.length === 0 && <p className="driver-empty">No driver applications yet.</p>}
        </section>
      </>}

      {activeTab === 'cash' && <section className="admin-panel driver-panel driver-simple-panel">
        <div className="admin-section-heading"><div><h2>COD cash reconciliation</h2><p>Compare cash the driver collected with cash physically received by JTBazar.</p></div><ShieldCheck size={22}/></div>
        <div className="admin-table-wrap driver-table-wrap"><table className="admin-table driver-table">
          <thead><tr><th>Order</th><th>Customer / driver</th><th>Order total</th><th>Driver collected</th><th>Received by admin</th><th>Status</th><th>Proof / action</th></tr></thead>
          <tbody>{cashRows.map(row => <tr key={row.assignment_id}>
            <td><strong>{row.order_number}</strong></td><td>{row.customer_name}<br/><small>{row.driver_name}</small></td>
            <td>PKR {Number(row.order_total).toLocaleString()}</td><td>{row.collected_amount == null ? 'Not recorded' : 'PKR ' + Number(row.collected_amount).toLocaleString()}</td>
            <td>{row.reconciled_amount == null ? 'Not received' : 'PKR ' + Number(row.reconciled_amount).toLocaleString()}</td>
            <td><span className="admin-status">{row.reconciled_at ? 'Reconciled' : row.collected_amount == null ? 'Awaiting driver' : 'Cash pending'}</span>{row.reconciliation_note ? <small><br/>{row.reconciliation_note}</small> : null}</td>
            <td><div className="driver-review-actions"><button className="admin-button admin-button--outline" onClick={() => void openDeliveryProof(row)}><FileImage size={14}/> Proof</button>{row.collected_amount != null && !row.reconciled_at ? <button className="admin-button" disabled={busy} onClick={() => void reconcileCash(row)}><Save size={14}/> Reconcile</button> : null}</div></td>
          </tr>)}</tbody></table></div>
        {cashRows.length === 0 && <p className="driver-empty">No COD cash collections yet.</p>}
      </section>}

      {loading && <p>Loading delivery information…</p>}
    </main>
  )
}
