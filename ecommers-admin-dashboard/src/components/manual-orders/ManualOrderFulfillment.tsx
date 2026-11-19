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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = getSupabase() as any
      const [itemsResult, driversResult, assignmentsResult] = await Promise.all([
        client.from('manual_order_items').select('*').eq('manual_order_id', orderId).order('created_at'),
        client.rpc('admin_list_manual_order_drivers'),
        client.rpc('admin_list_manual_order_driver_assignments', { p_order_id: orderId }),
      ])
      if (itemsResult.error) throw new Error(itemsResult.error.message)
      if (driversResult.error) throw new Error(driversResult.error.message)
      if (assignmentsResult.error) throw new Error(assignmentsResult.error.message)
      const nextItems = (itemsResult.data ?? []) as ManualItem[]
      setItems(nextItems)
      setDrivers((driversResult.data ?? []) as Driver[])
      setAssignments((assignmentsResult.data ?? []) as Assignment[])
      setSelectedItems(current => current.filter(id => nextItems.some(item => item.id === id && item.delivery_readiness_status === 'ready')))
      setDriverId(current => current || String((driversResult.data ?? [])[0]?.driver_user_id ?? ''))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Manual order fulfilment could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { void load() }, [load])

  async function updateItem(item: ManualItem, action: 'vendor_approved' | 'vendor_rejected' | 'mark_ready') {
    const prompts: Record<string, string> = {
      vendor_approved: 'Record vendor approval only after the vendor has confirmed this item. Continue?',
      vendor_rejected: 'Record that the vendor rejected this item?',
      mark_ready: 'Confirm this item is physically ready for driver pickup?',
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

  const readyItems = items.filter(item => item.delivery_readiness_status === 'ready')
  const money = (value: number | string | null) => `PKR ${Number(value ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

  return <section className="admin-panel" style={{ marginBottom: 20 }}>
    <div className="admin-panel-heading">
      <div><p className="admin-kicker">Manual order fulfilment</p><h3>Vendor approval & driver assignment</h3>
        <p className="admin-copy">Vendor items must be approved and marked ready. JTBazar items need no vendor approval.</p></div>
      <button type="button" className="admin-button admin-button--outline" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="admin-state admin-state--error"><CircleAlert size={17}/>{error}</div>}
    {loading ? <div className="admin-state"><RefreshCw size={17} className="spin"/> Loading fulfilment…</div> : <>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => {
          const canSelect = item.delivery_readiness_status === 'ready'
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
                <button type="button" className="admin-small-button" disabled={saving} onClick={() => void updateItem(item, 'mark_ready')}>Mark ready for pickup</button>}
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
        <div className="admin-copy">{readyItems.length} ready item(s) · {selectedItems.length} selected</div>
        <button type="button" className="admin-button" onClick={() => void assignDriver()} disabled={saving || !driverId || !selectedItems.length}>
          {saving ? <><RefreshCw size={14} className="spin"/> Saving…</> : <><Truck size={14}/> Assign driver to selected items</>}
        </button>
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="admin-panel-heading"><div><p className="admin-kicker">Assignment history</p><h3>{assignments.length} driver assignment(s)</h3></div></div>
        {assignments.length === 0 ? <p className="admin-copy">No driver assigned yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Driver</th><th>Items</th><th>Status</th><th>COD due</th><th>Assigned</th></tr></thead><tbody>
          {assignments.map(row => <tr key={row.assignment_id}><td><strong>{row.driver_name || 'Driver'}</strong><small>{row.driver_phone}</small></td><td>{row.item_count}</td><td><em className={`admin-status admin-status--${row.assignment_status}`}>{statusLabel[row.assignment_status] ?? row.assignment_status}</em></td><td>{money(row.cod_due_amount)}</td><td>{new Date(row.assigned_at).toLocaleString()}</td></tr>)}
        </tbody></table></div>}
      </div>
      <p className="admin-copy" style={{ marginTop: 12 }}>Assigning a driver does not confirm the order or change its total, delivery fee, payment, inventory, or order status. Vendor approval above is an admin record of confirmation received from the vendor.</p>
    </>}
  </section>
}
