import { useEffect, useState } from 'react'
import { Check, RefreshCw, Truck, UserRoundCheck, X, ShieldCheck, Users, PackageCheck } from 'lucide-react'
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
