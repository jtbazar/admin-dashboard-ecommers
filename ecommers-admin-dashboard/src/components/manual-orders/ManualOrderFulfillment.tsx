import { useCallback, useEffect, useState } from 'react'
import { Check, CircleAlert, RefreshCw, Truck } from 'lucide-react'
import { getSupabase } from '../../lib/supabase'

type ManualItem = {
  id: string
  product_name_snapshot: string
  seller_name_snapshot: string | null
  seller_id: string | null
  sku_snapshot: string | null
  quantity: number
  unit_price: number
  line_total: number
  vendor_approval_status: string
  delivery_readiness_status: string
  vendor_approval_note: string | null
}
type Driver = { driver_user_id: string; driver_name: string; driver_phone: string; company_name: string | null; vehicle_type: string | null }
type Assignment = {
  assignment_id: string
  driver_name: string
  driver_phone: string
  assignment_status: string
  cod_due_amount: number
  cod_collected_amount: number | null
  cash_reconciled_amount: number | null
  cash_reconciled_at: string | null
  cash_reconciliation_note: string | null
  delivery_proof_path: string | null
  assigned_at: string
  picked_up_at: string | null
  delivered_at: string | null
  failed_reason: string | null
  failed_note: string | null
  item_count: number
}

const statusLabel: Record<string, string> = {
  not_required: 'No vendor approval needed',
  pending: 'Waiting for vendor approval',
  approved: 'Vendor approved',
  rejected: 'Vendor rejected',
  not_ready: 'Not ready',
  ready: 'Ready for delivery',
  assigned: 'Driver assigned',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  failed: 'Delivery failed',
  cancelled: 'Cancelled',
}

export function ManualOrderFulfillment({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<ManualItem[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [driverId, setDriverId] = useState('')
  const [otpCodes, setOtpCodes] = useState<Record<string, string>>({})
  const [otpBusyId, setOtpBusyId] = useState<string | null>(null)
  const [orderStatus, setOrderStatus] = useState('pending')
  const [statusDraft, setStatusDraft] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = getSupabase() as any
      const [itemsResult, driversResult, assignmentsResult, orderResult] = await Promise.all([
        client.from('manual_order_items').select('*').eq('manual_order_id', orderId).order('created_at'),
        client.rpc('admin_list_manual_order_drivers'),
        client.rpc('admin_list_manual_order_driver_assignments_v2', { p_order_id: orderId }),
        client.from('manual_orders').select('order_status').eq('id', orderId).single(),
      ])
      if (itemsResult.error) throw new Error(itemsResult.error.message)
      if (driversResult.error) throw new Error(driversResult.error.message)
      if (assignmentsResult.error) throw new Error(assignmentsResult.error.message)
      if (orderResult.error) throw new Error(orderResult.error.message)
      const nextItems = (itemsResult.data ?? []) as ManualItem[]
      setItems(nextItems)
      setDrivers((driversResult.data ?? []) as Driver[])
      const nextAssignments = (assignmentsResult.data ?? []) as Assignment[]
      setAssignments(nextAssignments)
      const otpEntries = await Promise.all(nextAssignments.filter(row => row.assignment_status === 'picked_up').map(async row => {
        const { data } = await client.rpc('admin_get_manual_order_delivery_otp', { p_assignment_id: row.assignment_id })
        const code = String(data ?? '').replace(/^"|"$/g, '')
        return /^\d{6}$/.test(code) ? [row.assignment_id, code] as const : null
      }))
      setOtpCodes(Object.fromEntries(otpEntries.filter((entry): entry is readonly [string, string] => Boolean(entry))))
      setOrderStatus(String(orderResult.data?.order_status ?? 'pending'))
      setStatusDraft(String(orderResult.data?.order_status ?? 'pending'))
      setSelectedItems(current => current.filter(id => nextItems.some(item => item.id === id && ['ready','failed'].includes(item.delivery_readiness_status))))
      setDriverId(current => current || String((driversResult.data ?? [])[0]?.driver_user_id ?? ''))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Manual order fulfilment could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const client = getSupabase() as any
    const channel = client.channel(`manual-order-otp-${orderId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'manual_order_driver_assignments',
        filter: `manual_order_id=eq.${orderId}`,
      }, () => { void load() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [orderId, load])

  async function saveOrderStatus() {
    if (!statusDraft || statusDraft === orderStatus) return
    const labels: Record<string, string> = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }
    if (!window.confirm(`Change this manual order status from ${labels[orderStatus] ?? orderStatus} to ${labels[statusDraft] ?? statusDraft}? This only updates the order status; totals, payment, delivery fee, stock and vendor approval stay unchanged.`)) return
    setSaving(true)
    setError(null)
    try {
      const client = getSupabase() as any
      const { data, error: updateError } = await client.from('manual_orders')
        .update({ order_status: statusDraft, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select('order_status')
        .single()
      if (updateError) throw new Error(updateError.message)
      const savedStatus = String(data?.order_status ?? statusDraft)
      setOrderStatus(savedStatus)
      setStatusDraft(savedStatus)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Manual order status could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function updateItem(item: ManualItem, action: 'vendor_approved' | 'vendor_rejected' | 'mark_ready') {
    const prompts: Record<string, string> = {
      vendor_approved: 'Record vendor approval only after the vendor has confirmed this item. Continue?',
      vendor_rejected: 'Record that the vendor rejected this item?',
      mark_ready: 'Confirm JTBazar has collected this vendor item and it is physically ready for driver pickup?',
    }
    if (!window.confirm(prompts[action])) return
    setSaving(true)
    try {
      const client = getSupabase() as any
      const { error: actionError } = await client.rpc('admin_update_manual_order_item_fulfillment', {
        p_item_id: item.id, p_action: action, p_note: null,
      })
      if (actionError) throw new Error(actionError.message)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Item status could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function generateDeliveryOtp(row: Assignment) {
    if (!window.confirm("Generate a new 6-digit delivery code? Share it with the customer by phone or WhatsApp.")) return
    setOtpBusyId(row.assignment_id)
    setError(null)
    try {
      const client = getSupabase() as any
      const { data, error: otpError } = await client.rpc('admin_generate_manual_order_delivery_otp', {
        p_assignment_id: row.assignment_id,
      })
      if (otpError) throw new Error(otpError.message)
      const code = String(data ?? '').replace(/^"|"$/g, '')
      if (!/^\d{6}$/.test(code)) throw new Error('A valid 6-digit code was not returned.')
      setOtpCodes(current => ({ ...current, [row.assignment_id]: code }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delivery code could not be generated.')
    } finally {
      setOtpBusyId(null)
    }
  }

  async function assignDriver() {
    if (!driverId || selectedItems.length === 0) return
    if (!window.confirm(`Assign ${selectedItems.length} ready item(s) to this driver? Order total and status will remain unchanged.`)) return
    setSaving(true)
    setError(null)
    try {
      const client = getSupabase() as any
      const { error: assignError } = await client.rpc('admin_assign_driver_to_manual_order', {
        p_manual_order_id: orderId,
        p_driver_user_id: driverId,
        p_item_ids: selectedItems,
      })
      if (assignError) throw new Error(assignError.message)
      setSelectedItems([])
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Driver could not be assigned.')
    } finally {
      setSaving(false)
    }
  }

  const readyItems = items.filter(item => ['ready','failed'].includes(item.delivery_readiness_status))
  const canAssign = orderStatus === 'processing' || orderStatus === 'shipped'
  const money = (value: number | string | null) => `PKR ${Number(value ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

  return <section className="admin-panel" style={{ marginBottom: 20 }}>
    <div className="admin-panel-heading">
      <div><p className="admin-kicker">Manual order fulfilment</p><h3>Vendor approval & driver assignment</h3>
        <p className="admin-copy">Vendor items must be approved, collected by JTBazar and marked ready. JTBazar items need no vendor approval.</p></div>
      <button type="button" className="admin-button admin-button--outline" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="admin-state admin-state--error"><CircleAlert size={17}/>{error}</div>}
    {loading ? <div className="admin-state"><RefreshCw size={17} className="spin"/> Loading fulfilment…</div> : <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', padding: 12, marginBottom: 14, border: '1px solid var(--admin-border,#d9dee7)', borderRadius: 10 }}>
        <label style={{ display: 'grid', gap: 6, minWidth: 220, flex: 1, fontSize: 13, fontWeight: 600 }}>Manual order status
          <select style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--admin-border,#d9dee7)', borderRadius: 8, background: 'var(--admin-surface,#fff)', color: 'inherit', font: 'inherit' }} value={statusDraft} onChange={event => setStatusDraft(event.target.value)} disabled={saving}>
            {[[ 'pending', 'Pending' ], [ 'processing', 'Processing' ], [ 'shipped', 'Shipped' ], [ 'delivered', 'Delivered' ], [ 'cancelled', 'Cancelled' ]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="admin-button" onClick={() => void saveOrderStatus()} disabled={saving || statusDraft === orderStatus}>
          {saving ? <><RefreshCw size={14} className="spin"/> Saving…</> : 'Update order status'}
        </button>
        <span className="admin-copy">Current status: {orderStatus}</span>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => {
          const canSelect = ['ready','failed'].includes(item.delivery_readiness_status)
          return <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--admin-border,#d9dee7)', borderRadius: 10 }}>
            <input type="checkbox" aria-label={`Select ${item.product_name_snapshot} for driver assignment`} checked={selectedItems.includes(item.id)} disabled={!canSelect || saving} onChange={event => setSelectedItems(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/>
            <div style={{ minWidth: 0 }}>
              <strong>{item.product_name_snapshot}</strong>
              <div className="admin-copy">{item.seller_id ? (item.seller_name_snapshot || 'Vendor product') : 'JTBazar product'} · Qty {item.quantity} · {money(item.line_total)}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                <em className={`admin-status admin-status--${item.vendor_approval_status}`}>{statusLabel[item.vendor_approval_status] ?? item.vendor_approval_status}</em>
                <em className={`admin-status admin-status--${item.delivery_readiness_status}`}>{statusLabel[item.delivery_readiness_status] ?? item.delivery_readiness_status}</em>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {item.seller_id && item.vendor_approval_status === 'pending' && <>
                <button type="button" className="admin-small-button" disabled={saving} onClick={() => void updateItem(item, 'vendor_approved')}><Check size={13}/> Record vendor approval</button>
                <button type="button" className="admin-small-button admin-small-button--danger" disabled={saving} onClick={() => void updateItem(item, 'vendor_rejected')}>Reject</button>
              </>}
              {item.vendor_approval_status === 'approved' && item.delivery_readiness_status === 'not_ready' &&
                <button type="button" className="admin-small-button" disabled={saving} onClick={() => void updateItem(item, 'mark_ready')}>Mark collected & ready for driver</button>}
            </div>
          </div>
        })}
        {items.length === 0 && <div className="admin-empty"><Truck size={22}/><strong>No order items</strong><p>This manual order has no saved products.</p></div>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--admin-border,#d9dee7)' }}>
        <label style={{ display: 'grid', gap: 6, minWidth: 220, flex: 1, fontSize: 13, fontWeight: 600 }}>Approved driver
          <select style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border,#d9dee7)", borderRadius: 8, background: "var(--admin-surface,#fff)", color: "inherit", font: "inherit" }} value={driverId} onChange={event => setDriverId(event.target.value)} disabled={!drivers.length || saving}>
            {drivers.length === 0 ? <option value="">No approved drivers available</option> : drivers.map(driver => <option key={driver.driver_user_id} value={driver.driver_user_id}>{driver.driver_name} · {driver.driver_phone}</option>)}
          </select>
        </label>
        <div className="admin-copy">{readyItems.length} eligible item(s) · {selectedItems.length} selected · Order: {orderStatus}</div>
        <button type="button" className="admin-button" onClick={() => void assignDriver()} disabled={saving || !driverId || !selectedItems.length || !canAssign}>
          {saving ? <><RefreshCw size={14} className="spin"/> Saving…</> : <><Truck size={14}/> Assign driver to selected items</>}
        </button>
      </div>
      {!canAssign && <p className="admin-callout" style={{ marginTop: 12 }}>Driver assign karne se pehle order status ko Processing ya Shipped karein. Assignment status ko khud change nahi karegi.</p>}
      <div style={{ marginTop: 18 }}>
        <div className="admin-panel-heading"><div><p className="admin-kicker">Assignment history</p><h3>{assignments.length} driver assignment(s)</h3></div></div>
        {assignments.length === 0 ? <p className="admin-copy">No driver assigned yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Driver</th><th>Items</th><th>Status</th><th>COD due</th><th>Collected</th><th>Reconciled</th><th>Assigned / OTP</th></tr></thead><tbody>
          {assignments.map(row => <tr key={row.assignment_id}>
            <td><strong>{row.driver_name || 'Driver'}</strong><small>{row.driver_phone}</small></td>
            <td>{row.item_count}</td>
            <td><em className={'admin-status admin-status--' + row.assignment_status}>{statusLabel[row.assignment_status] ?? row.assignment_status}</em></td>
            <td>{money(row.cod_due_amount)}</td>
            <td>{row.cod_collected_amount == null ? '—' : money(row.cod_collected_amount)}</td>
            <td>{row.cash_reconciled_amount == null ? 'Pending' : money(row.cash_reconciled_amount)}</td>
            <td>
              <small>{new Date(row.assigned_at).toLocaleString()}</small>
              {row.assignment_status === 'picked_up' && <div style={{ marginTop: 6 }}>
                <button type="button" className="admin-small-button" disabled={otpBusyId === row.assignment_id || saving} onClick={() => void generateDeliveryOtp(row)}>
                  {otpBusyId === row.assignment_id ? 'Generating…' : otpCodes[row.assignment_id] ? 'Generate new OTP' : 'Generate customer OTP'}
                </button>
                {otpCodes[row.assignment_id] && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <strong style={{ letterSpacing: 2 }}>{otpCodes[row.assignment_id]}</strong>
                  <button type="button" className="admin-small-button" onClick={() => { void navigator.clipboard?.writeText(otpCodes[row.assignment_id]).catch(() => window.prompt('Copy this customer OTP', otpCodes[row.assignment_id])) }}>Copy</button>
                </div>}
                <small>Automatically generated when the driver picks up the parcel. Share this code with the customer on WhatsApp. It expires in 30 minutes.</small>
              </div>}
            </td>
          </tr>)}
        </tbody></table></div>}
      </div>
      <p className="admin-copy" style={{ marginTop: 12 }}>Assigning a driver does not confirm the order or change its total, delivery fee, payment, inventory, or order status. Vendor approval above is recorded by admin only after confirmation from the vendor; the ready action records JTBazar collection and readiness for driver pickup.</p>
    </>}
  </section>
}
