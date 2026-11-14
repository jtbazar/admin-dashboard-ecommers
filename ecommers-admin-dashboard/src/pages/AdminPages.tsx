import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Archive, ArrowLeft, BarChart3, Bell, Boxes, Check, CheckCheck, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Edit2, Film, FolderTree, Eye, EyeOff, Image as ImageIcon, Info, LayoutDashboard, LogOut, MapPin, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, MessageSquare, Package, Plus, Printer, RefreshCw, Search, Send, Settings, ShieldAlert, Star, Store, Tag, Trash2, Truck, Users, Volume2, VolumeX, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { adjustInventory, decideMarketplaceCase, deleteAdminHero, deleteAdminPromotion, deleteProductVariant, getAdminOrderDetail, getAdminProductEditor, getAdminStoreSettings, getAdminFoodDeliverySettings, getAdminCommissionSettings, getAdminSummary, getVendorDocumentSignedUrl, listAdminCategories, listAdminAccountSuspensions, listAdminCustomers, listAdminHeroes, listAdminInventory, listAdminNotifications, listAdminOrders, listAdminOrderVendors, listAdminVendorPickups, markAdminVendorPickedUp, listAdminProducts, listAdminProductsPage, listAdminVendorDirectoryPage, listAdminPromotions, listAdminCustomerReviews, setAdminCustomerReviewStatus, listAdminSupportTickets, listAdminSellerSupportMessages, sendAdminSellerSupportMessage, listAdminCustomerSupportMessages, sendAdminCustomerSupportMessage, listAuditLogs, listMarketplaceCases, listSellerApplications, markAdminNotificationRead, markAllAdminNotificationsRead, sendAdminPushTest, sendAdminManualNotification, moderateProduct, deleteAdminProductImage, deleteAdminProductPermanently, listAdminProductDeletionRequests, reviewAdminProductDeletion, reviewSellerApplication, setAdminVendorLock, setAdminSupportTicketStatus, saveAdminHero, saveAdminPromotion, saveCategory, saveProduct, saveProductVariant, saveAdminProductInventory, setAdminAccountSuspension, updateAdminStoreSettings, updateAdminFoodDeliverySettings, updateAdminCommissionSettings, updateAdminSupportTicket, updateOrder, saveDeliveryCollection, addOrderNote, rejectAdminOrder, findCustomerDeliveryOrders, confirmOrdersWithDeliveryBatch, createFollowupDeliveryBatch, markDeliveryBatchDelivered, listOrderDeliveryBatches, updateProductStatus, updateProductsHotDeal, setAdminProductFeatured, uploadAdditionalProductImage, uploadPublicMedia, type AdminCaseDetail, type AdminCategory, type AdminCustomerReview, type AdminAccountSuspension, type AdminCustomer, type AdminHero, type AdminInventory, type AdminNotification, type AdminOrder, type AdminOrderVendor, type AdminProduct, type AdminProductDeletionRequest, type AdminPromotion, type AdminSeller, type AdminStoreSettings, type AdminFoodDeliverySettings, type AdminCommissionSettings, type AdminSummary, type AdminSupportInboxTicket, type AdminSupportChatMessage, type AdminVariant } from '../services/admin/adminService'
import type { Database } from '../types/database'
import { getSupabase } from '../lib/supabase'
import { isValidEmail, isValidPakistaniMobile, normalizePakistaniMobile } from '../utils/contactValidation'
import { DriverManagement } from './DriverManagement'
import { ProductVideos } from './ProductVideos'
import '../admin.css'

const nav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/heroes', label: 'Heroes', icon: ImageIcon },
  { to: '/admin/promotions', label: 'Banners & Ads', icon: Tag },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/product-videos', label: 'Product Videos', icon: Film },
  { to: '/admin/hot-deals', label: 'Campaign Manager', icon: Tag },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/vendor-products', label: 'Vendor Products', icon: Store },
  { to: '/admin/reviews', label: 'Customer reviews', icon: Star },
  { to: '/admin/manual-orders', label: 'Manual Orders', icon: Plus },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/sellers', label: 'Sellers', icon: Store },
  { to: '/admin/drivers', label: 'Drivers', icon: Truck },
  { to: '/admin/push-notifications', label: 'Push Notifications', icon: Bell },
  { to: '/admin/cases', label: 'Cases', icon: MessageSquare },
  { to: '/admin/tickets', label: 'Support tickets', icon: MessageSquare },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/settings', label: 'Store settings', icon: Settings },
  { to: '/admin/audit', label: 'Audit log', icon: ShieldAlert },
]

function notificationSectionPath(item: AdminNotification): string | null {
  const title = `${item.title} ${item.body}`.toLowerCase()
  if (item.kind === 'order' || title.includes('order')) return '/admin/orders'
  if (title.includes('vendor product') || title.includes('vendor listing') || (title.includes('product') && title.includes('vendor'))) return '/admin/vendor-products'
  if (title.includes('product') || title.includes('listing')) return '/admin/products'
  if (title.includes('seller') || title.includes('vendor') || title.includes('shop')) return '/admin/sellers'
  if (title.includes('case') || title.includes('complaint') || title.includes('return') || title.includes('refund')) return '/admin/cases'
  if (title.includes('review') || title.includes('rating')) return '/admin/reviews'
  if (title.includes('ticket') || title.includes('support')) return '/admin/tickets'
  if (title.includes('customer')) return '/admin/customers'
  return null
}

function Loading() { return <div className="admin-state"><RefreshCw className="spin" size={20} /><span>Loading live store data…</span></div> }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="admin-state admin-state--error"><CircleAlert size={20} /><span>{message}</span><button className="admin-button admin-button--outline" onClick={retry}>Try again</button></div> }
function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="admin-empty"><Tag size={24} /><strong>{title}</strong><p>{detail}</p>{action}</div> }
function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) { return <div className="admin-metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div> }
function formatMoney(value: number | string) { return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) }
function statusClass(value: string) { return `admin-status admin-status--${value.replace('_', '-')}` }

function mergeRowsById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const previous = new Map(current.map((row) => [row.id, row]))
  return incoming.map((next) => { const old = previous.get(next.id); return old && JSON.stringify(old) === JSON.stringify(next) ? old : old ? { ...old, ...next } : next })
}

function useAutoRefresh(refresh: (quiet?: boolean) => void, intervalMs = 20000) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    let lastRun = 0
    const run = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRun < 1500) return
      lastRun = Date.now()
      refreshRef.current(true)
    }
    const timer = window.setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}

function Guard({ children }: { children: ReactNode }) {
  const { loading, user, isAdmin, configured, error } = useAuth()
  const [mfaReady,setMfaReady]=useState(false)
  const [aal2,setAal2]=useState(false)
  const [emailOtp,setEmailOtp]=useState(false)
  const navigate=useNavigate()
  useEffect(()=>{let active=true;if(!user||!isAdmin){setMfaReady(false);setAal2(false);setEmailOtp(false);return()=>{active=false}};void (async()=>{try{const c=getSupabase();const [{data:a,error:mfaError},{data:s,error:sessionError}]=await Promise.all([c.auth.mfa.getAuthenticatorAssuranceLevel(),c.auth.getSession()]);if(!active)return;const token=s.session?.access_token??'';let methods:string[]=[];try{const part=token.split('.')[1];const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'='))) as {amr?:Array<{method?:string}>};methods=Array.isArray(payload.amr)?payload.amr.map(x=>x.method??''):[]}catch{};const hasOtp=methods.includes('otp');setEmailOtp(!sessionError&&hasOtp);setAal2(!mfaError&&a?.currentLevel==='aal2');setMfaReady(true)}catch{if(active){setEmailOtp(false);setAal2(false);setMfaReady(true)}}})();return()=>{active=false}},[user?.id,isAdmin])
  useEffect(()=>{if(!loading&&user&&isAdmin&&mfaReady&&!emailOtp)navigate('/admin-email-otp',{replace:true,state:{email:user.email??''}});else if(!loading&&user&&isAdmin&&mfaReady&&emailOtp&&!aal2)navigate('/admin-mfa',{replace:true})},[loading,user?.id,isAdmin,mfaReady,emailOtp,aal2,navigate])
  if (loading || (user&&isAdmin&&!mfaReady)) return <div className="admin-screen"><Loading /></div>
  if (!configured || !user) return <div className="admin-screen admin-screen--center"><ShieldAlert size={34} /><h1>Administrator sign-in required</h1><p>Sign in with an authorized JTBazar administrator account to continue.</p><Link className="admin-button" to="/login">Go to sign in</Link></div>
  if (error || !isAdmin) return <div className="admin-screen admin-screen--center"><ShieldAlert size={34} /><h1>Access denied</h1><p>{error ?? 'This account does not have the administrator role.'}</p><Link className="admin-button" to="/">Return to storefront</Link></div>
  if(!emailOtp||!aal2)return <div className="admin-screen"><Loading /></div>
  return <>{children}</>
}

export function AdminPage() {
  const location = useLocation()
  const path = location.pathname
  return <Guard><AdminShell><AdminContent path={path} /></AdminShell></Guard>
}

function AdminShell({ children }: { children: ReactNode }) {
  const { displayName, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => { try { return window.localStorage.getItem('jtbazar-admin-notification-sound') === 'on' } catch { return true } })
  const audioContextRef = useRef<AudioContext | null>(null)
  const notificationsInitializedRef = useRef(false)
  const knownNotificationIdsRef = useRef<Set<string>>(new Set())
  const navigate = useNavigate()
  const unreadCount = notifications.filter((item) => !item.read_at).length
  async function markSectionRead(path: string) {
    const pending = notifications.filter((item) => !item.read_at && notificationSectionPath(item) === path)
    if (pending.length === 0) return
    try {
      await Promise.all(pending.map((item) => markAdminNotificationRead(item.id)))
      const now = new Date().toISOString()
      setNotifications((current) => current.map((item) => pending.some((row) => row.id === item.id) ? { ...item, read_at: now } : item))
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : 'Section notifications could not be marked as seen.')
    }
  }
  function playAdminNotificationSound() {
    if (!soundEnabled) return
    const context = audioContextRef.current
    if (!context || context.state !== 'running') return
    const now = context.currentTime
    ;[0, 0.19].forEach((offset) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(offset === 0 ? 880 : 1174, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.15)
    })
  }
  function toggleNotificationSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    try { window.localStorage.setItem('jtbazar-admin-notification-sound', next ? 'on' : 'off') } catch {}
    if (next) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        const context = audioContextRef.current ?? new AudioContextClass()
        audioContextRef.current = context
        void context.resume()
      }
    }
  }
  const loadNotifications = () => { void listAdminNotifications().then((items) => {
    const incomingIds = new Set(items.map((item) => item.id))
    if (notificationsInitializedRef.current) {
      const hasNewUnread = items.some((item) => !knownNotificationIdsRef.current.has(item.id) && !item.read_at)
      if (hasNewUnread) playAdminNotificationSound()
    } else {
      notificationsInitializedRef.current = true
    }
    knownNotificationIdsRef.current = incomingIds
    setNotifications(items)
    setNotificationError(null)
  }).catch((cause: unknown) => setNotificationError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.')) }
  useEffect(() => {
    loadNotifications()
    let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null
    let active = true
    void (async () => {
      try {
        const client = getSupabase()
        const { data } = await client.auth.getUser()
        if (!active || !data.user) return
        channel = client.channel('admin-notifications-' + data.user.id)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + data.user.id }, () => loadNotifications())
          .subscribe()
      } catch { /* 20-second refresh remains as a fallback if Realtime is unavailable. */ }
    })()
    const run = () => { if (document.visibilityState === 'visible') loadNotifications() }
    const timer = window.setInterval(run, 20000)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => { active = false; if (channel) void getSupabase().removeChannel(channel); window.clearInterval(timer); window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', run) }
  }, [])
  async function logout() { await signOut(); navigate('/login') }
  async function openNotification(item: AdminNotification) {
    const path = notificationSectionPath(item)
    if (path) await markSectionRead(path)
    else if (!item.read_at) {
      try {
        await markAdminNotificationRead(item.id)
        setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
      } catch (cause) {
        setNotificationError(cause instanceof Error ? cause.message : 'Notification could not be marked read.')
      }
    }
    setNotificationsOpen(false)
    navigate(path ?? '/admin')
  }
  async function markAllRead() {
    try { await markAllAdminNotificationsRead(); const now = new Date().toISOString(); setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now }))) }
    catch (cause) { setNotificationError(cause instanceof Error ? cause.message : 'Notifications could not be updated.') }
  }
  return <div className={`admin-app${collapsed ? ' admin-app--collapsed' : ''}`}>
    <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
      <div className="admin-brand"><img className="admin-brand-logo" src="/jtbazar-logo.webp" alt="JTBazar" /><span>JTBazar<small>ADMIN STUDIO</small></span><button type="button" className="admin-sidebar-toggle admin-sidebar-toggle--brand" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div>
      <nav className="admin-nav" aria-label="Admin navigation">{nav.map(({ to, label, icon: Icon }) => { const badgeCount = notifications.filter((item) => !item.read_at && notificationSectionPath(item) === to).length; return <NavLink key={to} to={to} end={to === '/admin'} onClick={() => { setOpen(false); void markSectionRead(to) }}><Icon size={17} /><span>{label}</span>{badgeCount > 0 && <b className="admin-nav-badge" aria-label={badgeCount + " new items"}>{badgeCount > 99 ? "99+" : badgeCount}</b>}</NavLink> })}</nav>
      <div className="admin-sidebar-footer"><Link to="/"><ArrowLeft size={15} /> View storefront</Link><button onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div>
    </aside>
    {open && <button className="admin-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <main className="admin-main"><header className="admin-topbar"><button className="admin-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button><div><span className="admin-kicker">JTBazar operations</span><h1>{location.pathname.startsWith('/admin/manual-orders/') ? 'Manual order detail' : location.pathname.startsWith('/admin/orders/') ? 'Order detail' : nav.find((item) => location.pathname === item.to)?.label ?? 'Admin studio'}</h1></div><div className="admin-topbar-actions"><button type="button" className="admin-notification-button" aria-label={soundEnabled ? "Mute notification sound" : "Enable notification sound"} title={soundEnabled ? "Mute notification sound" : "Enable notification sound"} aria-pressed={soundEnabled} onClick={toggleNotificationSound}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><div className="admin-notification-wrap"><button type="button" className="admin-notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((value) => !value); loadNotifications() }}><Bell size={19} />{unreadCount > 0 && <span className="admin-notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>{notificationsOpen && <div className="admin-notification-popover" role="dialog" aria-label="Admin notifications"><div className="admin-notification-heading"><strong>Notifications</strong><button type="button" onClick={() => void markAllRead()} disabled={!unreadCount}><CheckCheck size={14} /> Mark all read</button></div>{notificationError && <p className="admin-notification-error">{notificationError}</p>}{notifications.length === 0 ? <p className="admin-notification-empty">No activity notifications yet.</p> : notifications.map((item) => <button type="button" key={item.id} className={`admin-notification-item${item.read_at ? '' : ' is-unread'}`} onClick={() => void openNotification(item)}><span><strong>{item.title}</strong><small>{item.body}</small><small>{formatDate(item.created_at)}</small></span>{!item.read_at && <i aria-label="Unread" />}</button>)}</div>}</div><div className="admin-user"><span>{displayName ?? 'Administrator'}</span><span className="admin-avatar">{(displayName ?? 'A').slice(0, 1).toUpperCase()}</span></div></div></header>{children}</main>
  </div>
}

function AdminContent({ path }: { path: string }) {
  if (path === '/admin') return <Overview />
  if (path === '/admin/heroes') return <Heroes />
  if (path === '/admin/promotions') return <Promotions />
  if (path === '/admin/products') return <Products />
  if (path === '/admin/product-videos') return <ProductVideos />
  if (path === '/admin/vendor-products') return <VendorProducts />
  if (/^\/admin\/vendor-products\/[^/]+$/.test(path)) return <VendorProducts sellerId={path.split('/').pop()!} />
  if (path === '/admin/hot-deals') return <HotDeals />
  if (path === '/admin/categories') return <Categories />
  if (path === '/admin/orders') return <Orders />
  if (path === '/admin/reviews') return <CustomerReviews />
  if (path === '/admin/manual-orders') return <ManualOrders />
  if (/^\/admin\/manual-orders\/[^/]+$/.test(path)) return <ManualOrderDetailPage orderId={path.split('/').pop()!} />
  if (/^\/admin\/orders\/[^/]+$/.test(path)) return <OrderDetailPage orderId={path.split('/').pop()!} />
  if (path === '/admin/inventory') return <Inventory />
  if (path === '/admin/sellers') return <Sellers />
  if (path === '/admin/drivers') return <DriverManagement />
  if (path === '/admin/push-notifications') return <PushNotifications />
  if (path === '/admin/cases') return <Cases />
  if (path === '/admin/tickets') return <SupportTickets />
  if (path === '/admin/customers') return <Customers />
  if (path === '/admin/settings') return <StoreSettings />
  return <Audit />
}

function Overview() {
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [reportMode, setReportMode] = useState<'monthly' | 'yearly'>('monthly')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [finance, setFinance] = useState<{ total: number; collected: number; outstanding: number; orderCount: number; cancelled: number; rows: { date: string; number: string; customer: string; source: string; status: string; paymentStatus: string; total: number; paid: number; outstanding: number }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const load = () => { setError(null); void Promise.all([getAdminSummary(), listAdminOrders('', 'all', 0, 6)]).then(([nextSummary, nextOrders]) => { setSummary(nextSummary); setOrders(nextOrders.items) }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The overview could not be loaded.')) }
  useEffect(load, [])
  useAutoRefresh(load)

  useEffect(() => {
    let cancelled = false
    async function loadFinance() {
      setReportLoading(true)
      setError(null)
      try {
        const client = getSupabase()
        const fromDate = reportMode === 'monthly' ? new Date(`${month}-01T00:00:00`) : new Date(Number(year), 0, 1)
        const toDate = reportMode === 'monthly' ? new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 1) : new Date(Number(year) + 1, 0, 1)
        if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) || fromDate.getFullYear() < 2000 || fromDate.getFullYear() > 2100) throw new Error('Choose a valid report period.')
        const from = fromDate.toISOString()
        const to = toDate.toISOString()
        const [regularResult, manualResult] = await Promise.all([
          client.from('orders').select('order_number, customer_name, total, order_status, payment_status, created_at').gte('created_at', from).lt('created_at', to).order('created_at', { ascending: true }).limit(5000),
          client.from('manual_orders').select('manual_order_number, customer_name, total, paid_amount, order_status, payment_status, created_at').gte('created_at', from).lt('created_at', to).order('created_at', { ascending: true }).limit(5000),
        ])
        if (regularResult.error) throw new Error(regularResult.error.message)
        if (manualResult.error) throw new Error(manualResult.error.message)
        const regularRows = (regularResult.data ?? []).map((row) => {
          const total = Number(row.total ?? 0)
          const cancelledOrder = row.order_status === 'cancelled'
          const paid = row.payment_status === 'paid' && !cancelledOrder ? total : 0
          return { date: row.created_at, number: row.order_number, customer: row.customer_name, source: 'Online', status: row.order_status, paymentStatus: row.payment_status, total: cancelledOrder ? 0 : total, paid, outstanding: cancelledOrder ? 0 : Math.max(0, total - paid), cancelled: cancelledOrder }
        })
        const manualOrderRows = (manualResult.data ?? []) as unknown as { manual_order_number: string; customer_name: string; total: number | string | null; paid_amount: number | string | null; order_status: string; payment_status: string; created_at: string }[]
        const manualRows = manualOrderRows.map((row) => {
          const total = Number(row.total ?? 0)
          const cancelledOrder = row.order_status === 'cancelled'
          const paid = cancelledOrder ? 0 : Math.min(total, Math.max(0, Number(row.paid_amount ?? 0)))
          return { date: row.created_at, number: row.manual_order_number, customer: row.customer_name, source: 'Manual', status: row.order_status, paymentStatus: row.payment_status, total: cancelledOrder ? 0 : total, paid, outstanding: cancelledOrder ? 0 : Math.max(0, total - paid), cancelled: cancelledOrder }
        })
        const rows = [...regularRows, ...manualRows].sort((a, b) => a.date.localeCompare(b.date))
        if (!cancelled) setFinance({
          total: rows.reduce((sum, row) => sum + row.total, 0),
          collected: rows.reduce((sum, row) => sum + row.paid, 0),
          outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
          orderCount: rows.filter((row) => !row.cancelled).length,
          cancelled: rows.filter((row) => row.cancelled).length,
          rows: rows.map(({ cancelled: _cancelled, ...row }) => row),
        })
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Financial report could not be loaded.')
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }
    void loadFinance()
    return () => { cancelled = true }
  }, [reportMode, month, year])

  function downloadReport() {
    if (!finance) return
    const headers = ['Date', 'Order Number', 'Customer', 'Source', 'Order Status', 'Payment Status', 'Order Total (PKR)', 'Paid (PKR)', 'Outstanding (PKR)']
    const csv = [headers, ...finance.rows.map((row) => [new Date(row.date).toLocaleDateString('en-CA'), row.number, row.customer, row.source, row.status, row.paymentStatus, row.total, row.paid, row.outstanding])]
      .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `jtbazar-financial-report-${reportMode === 'monthly' ? month : year}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (error && !summary) return <ErrorState message={error} retry={load} />
  if (!summary) return <Loading />
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">A clear view of what needs attention</p><h2>Store overview & finances</h2><p className="admin-copy">Real figures from online and manually recorded orders.</p></div><button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15} /> Refresh</button></div>
    <div className="admin-metrics"><Metric label="All products" value={summary.total_products} note={`${summary.published_products} published`} /><Metric label="Active categories" value={summary.active_categories} /><Metric label="Pending orders" value={summary.pending_orders} note={`${summary.open_orders} open orders`} /><Metric label="Paid revenue" value={formatMoney(summary.paid_delivered_value)} note="Delivered and paid online orders" /></div>
    <div className="admin-panel admin-finance-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Money & reporting</p><h3>Financial report</h3><p className="admin-copy">Includes online checkout orders and Manual Orders. Cancelled orders are excluded from totals.</p></div><BarChart3 size={22} /></div>
      <div className="admin-toolbar admin-finance-toolbar">
        <div className="admin-segmented"><button type="button" className={reportMode === 'monthly' ? 'is-active' : ''} onClick={() => setReportMode('monthly')}>Monthly</button><button type="button" className={reportMode === 'yearly' ? 'is-active' : ''} onClick={() => setReportMode('yearly')}>Yearly</button></div>
        {reportMode === 'monthly' ? <label className="admin-report-field">Select month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label> : <label className="admin-report-field">Select year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label>}
        <button className="admin-button" onClick={downloadReport} disabled={!finance || reportLoading}><Archive size={15} /> Export CSV</button>
      </div>
      {error && <div className="admin-state admin-state--error"><CircleAlert size={18} />{error}</div>}
      {reportLoading && <div className="admin-state"><RefreshCw className="spin" size={18} /> Calculating report…</div>}
      {finance && !reportLoading && <><div className="admin-metrics admin-finance-metrics"><Metric label="Order value" value={formatMoney(finance.total)} note="Non-cancelled orders" /><Metric label="Money collected" value={formatMoney(finance.collected)} note="Paid amount received" /><Metric label="Outstanding balance" value={formatMoney(finance.outstanding)} note="Still to collect" /><Metric label="Orders counted" value={finance.orderCount} note={`${finance.cancelled} cancelled excluded`} /></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Source</th><th>Status</th><th>Payment</th><th>Order total</th><th>Paid</th><th>Due</th></tr></thead><tbody>{finance.rows.length === 0 ? <tr><td colSpan={9}>No orders were found for this period.</td></tr> : finance.rows.map((row) => <tr key={row.source + row.number}><td>{formatDate(row.date)}</td><td><strong>{row.number}</strong></td><td>{row.customer}</td><td>{row.source}</td><td><em className={statusClass(row.status)}>{row.status}</em></td><td>{row.paymentStatus}</td><td>{formatMoney(row.total)}</td><td>{formatMoney(row.paid)}</td><td>{formatMoney(row.outstanding)}</td></tr>)}</tbody></table></div>
      </>}
    </div>
    <div className="admin-overview-activity-wrap"><div className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">Latest activity</p><h3>Recent online orders</h3></div><Link to="/admin/orders">View all <ChevronRight size={14} /></Link></div>{orders.length === 0 ? <Empty title="No orders yet" detail="Real orders will appear here once buyers complete checkout." /> : <div className="admin-list">{orders.map((order) => <Link className="admin-list-row" to="/admin/orders" key={order.id}><span><strong>{order.order_number}</strong><small>{order.customer_name} · {formatDate(order.created_at)}</small></span><span><b>{formatMoney(order.total)}</b><em className={statusClass(order.order_status)}>{order.order_status}</em></span></Link>)}</div>}</div></div>
  </section>
}


type ProductActionMenuProps = {
  item: AdminProduct
  onDetails: () => void
  onEdit: () => void
  onModerate: (next: AdminProduct['moderation_status']) => void
  onPublication: () => void
  onArchive: () => void
  onDelete: () => void
}

function ProductActionMenu({ item, onDetails, onEdit, onModerate, onPublication, onArchive, onDelete }: ProductActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!anchor || !panel) return
      const top = anchor.bottom + panel.height + 10 <= window.innerHeight
        ? anchor.bottom + 6
        : Math.max(10, anchor.top - panel.height - 6)
      setPosition({ top, right: Math.max(10, window.innerWidth - anchor.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const run = (action: () => void) => { setOpen(false); action() }
  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div ref={panelRef} className="admin-action-menu__panel admin-action-menu__portal" role="menu"
      style={{ position: 'fixed', top: position?.top ?? 10, right: position?.right ?? 10, zIndex: 10000, visibility: position ? 'visible' : 'hidden' }}>
      <button type="button" role="menuitem" onClick={() => run(onDetails)}><Info size={14}/> View product details</button>
      <button type="button" role="menuitem" onClick={() => run(onEdit)}><Edit2 size={14}/> Edit product</button>
      {item.moderation_status === 'pending_review' && <>
        <button type="button" role="menuitem" onClick={() => run(() => onModerate('approved'))}><Check size={14}/> Approve</button>
        <button type="button" role="menuitem" onClick={() => run(() => onModerate('rejected'))}><X size={14}/> Reject</button>
      </>}
      {item.moderation_status === 'approved' && <button type="button" role="menuitem" onClick={() => run(() => onModerate('hidden'))}><EyeOff size={14}/> Hide</button>}
      {item.moderation_status === 'hidden' && <button type="button" role="menuitem" onClick={() => run(() => onModerate('approved'))}><Eye size={14}/> Unhide</button>}
      {item.publication_status !== 'archived' && <button type="button" role="menuitem" onClick={() => run(onPublication)}>{item.publication_status === 'published' ? <EyeOff size={14}/> : <Eye size={14}/>} {item.publication_status === 'published' ? 'Unpublish' : 'Publish'}</button>}
      <button type="button" role="menuitem" onClick={() => run(onArchive)}><Archive size={14}/> Archive</button>
      <button type="button" role="menuitem" className="is-danger" onClick={() => run(onDelete)}><Trash2 size={14}/> Delete permanently</button>
    </div>, document.body
  ) : null

  return <>
    <button ref={triggerRef} type="button" className="admin-product-menu-trigger" aria-label={`More actions for ${item.name}`}
      aria-haspopup="menu" aria-expanded={open} onClick={() => { setPosition(null); setOpen(value => !value) }}>
      <MoreHorizontal size={19}/>
    </button>
    {menu}
  </>
}

function Products() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminProduct[]>([]); const [search, setSearch] = useState(''); const [categoryId, setCategoryId] = useState(''); const [categories, setCategories] = useState<AdminCategory[]>([]); const [page, setPage] = useState(0); const [count, setCount] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined); const [detailsId, setDetailsId] = useState<string | null>(null); const [moderationTarget, setModerationTarget] = useState<{ item: AdminProduct; next: AdminProduct['moderation_status'] } | null>(null); const [moderationSaving, setModerationSaving] = useState(false); const [publishOnUnhide, setPublishOnUnhide] = useState(false); const [publicationTarget, setPublicationTarget] = useState<{ item: AdminProduct; next: 'published' | 'draft' } | null>(null); const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null); const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null); const [actionSaving, setActionSaving] = useState(false); const [moderationReason, setModerationReason] = useState(''); const [deletionRequests, setDeletionRequests] = useState<AdminProductDeletionRequest[]>([]); const [deletionReviewTarget, setDeletionReviewTarget] = useState<AdminProductDeletionRequest | null>(null); const [deletionReviewNote, setDeletionReviewNote] = useState('')
  const load = (quiet = false) => { if (!quiet) setLoading(true); setError(null); void Promise.all([listAdminProductsPage(search, page, 12, null, null, true, categoryId || null), listAdminProductDeletionRequests()]).then(([result, requests]) => { setItems(result.items); setCount(result.count); setDeletionRequests((current) => JSON.stringify(current) === JSON.stringify(requests) ? current : requests) }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Products could not be loaded.')).finally(() => { if (!quiet) setLoading(false) }) }
  useEffect(() => { void listAdminCategories().then(setCategories).catch(() => setCategories([])) }, [])
  useEffect(load, [search, categoryId, page])
  useAutoRefresh(load)
  function requestPublication(item: AdminProduct) { setPublicationTarget({ item, next: item.publication_status === 'published' ? 'draft' : 'published' }) }
  async function confirmPublication() { if (!publicationTarget) return; setActionSaving(true); try { await updateProductStatus(publicationTarget.item.id, publicationTarget.next); push(publicationTarget.next === 'published' ? 'Product published to the storefront.' : 'Product moved to draft and removed from the storefront.'); setPublicationTarget(null); setItems((current) => current.map((row) => row.id === publicationTarget.item.id ? { ...row, publication_status: publicationTarget.next } : row)) } catch (cause) { push(cause instanceof Error ? cause.message : 'Publication update failed.', 'error') } finally { setActionSaving(false) } }
  async function confirmArchive() { if (!archiveTarget) return; setActionSaving(true); try { await updateProductStatus(archiveTarget.id, 'archived'); push('Product archived.'); setArchiveTarget(null); setItems((current) => current.filter((row) => row.id !== archiveTarget.id)) } catch (cause) { push(cause instanceof Error ? cause.message : 'Product update failed.', 'error') } finally { setActionSaving(false) } }
  async function moderate(item: AdminProduct, next: AdminProduct['moderation_status']) { setModerationTarget({ item, next }); setPublishOnUnhide(false); setModerationReason('') }
  async function confirmModeration() { if (!moderationTarget) return; setModerationSaving(true); try { await moderateProduct(moderationTarget.item.id, moderationTarget.next, moderationTarget.next === 'rejected' ? moderationReason.trim() : undefined); if (moderationTarget.next === 'approved' && moderationTarget.item.moderation_status === 'hidden' && publishOnUnhide && moderationTarget.item.publication_status !== 'published') { try { await updateProductStatus(moderationTarget.item.id, 'published') } catch (cause) { setModerationTarget(null); push(cause instanceof Error ? `Product unhidden, but storefront publication failed: ${cause.message}` : 'Product unhidden, but storefront publication failed.', 'error'); load(); return } } push(moderationTarget.next === 'hidden' ? 'Product hidden from customers. Its publication status is preserved.' : moderationTarget.next === 'approved' ? (moderationTarget.item.moderation_status === 'pending_review' ? 'Product approved and published to the storefront.' : publishOnUnhide ? 'Product unhidden and published to the storefront.' : moderationTarget.item.publication_status === 'published' ? 'Product unhidden and restored to the storefront.' : 'Product unhidden; its draft publication setting is preserved.') : `Product marked ${moderationTarget.next}.`, 'success'); setItems((current) => current.map((row) => row.id === moderationTarget.item.id ? { ...row, moderation_status: moderationTarget.next, publication_status: moderationTarget.next === 'approved' && publishOnUnhide ? 'published' : row.publication_status } : row)); setModerationTarget(null) } catch (cause) { push(cause instanceof Error ? cause.message : 'Moderation update failed.', 'error') } finally { setModerationSaving(false) } }
  return <section className="admin-content"><div className="admin-page-heading"><div><p className="admin-kicker">Catalog management</p><h2>Products</h2></div><button className="admin-button" onClick={() => setEditing(null)}><Plus size={16} /> New product</button></div><div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search name, SKU or slug" /></label><label className="admin-filter-select"><FolderTree size={16}/><select aria-label="Filter products by category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(0) }}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15} /> Refresh</button></div>{editing !== undefined && <ProductEditor key={editing?.id ?? 'new-product'} product={editing ?? undefined} onSaved={() => { setEditing(undefined); load(true) }} onCancel={() => setEditing(undefined)} />}{error ? <ErrorState message={error} retry={load} /> : loading ? <Loading /> : items.length === 0 ? <Empty title="No platform products found" detail="Create a product when your catalog is ready. The storefront will remain empty until products are published." action={<button className="admin-button" onClick={() => setEditing(null)}><Plus size={15} /> Create product</button>} /> : <div className="admin-table-wrap admin-products-table-wrap"><table className="admin-table admin-products-table"><thead><tr><th scope="col">#</th><th>Product</th><th>Vendor</th><th>Category</th><th>Price</th><th>Stock</th><th>Storefront publication</th><th>Moderation visibility</th><th>Actions</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td data-label="#"><span className="admin-product-serial">{page * 12 + index + 1}</span></td><td data-label="Product"><div className="admin-product-cell">{item.image_url ? <img src={item.image_url} alt="" /> : <span className="admin-thumb"><Package size={15} /></span>}<span><strong>{item.name}</strong><small>{item.sku ?? 'No SKU'} · {item.slug}</small></span></div></td><td data-label="Vendor">{item.seller_name ?? 'Platform / no vendor'}</td><td data-label="Category">{item.category?.name ?? 'Unassigned'}</td><td data-label="Price">{item.discount_percent > 0 ? <><strong>{formatMoney(item.price * (1 - item.discount_percent / 100))}</strong><small><s>{formatMoney(item.price)}</s> · {item.discount_percent}% off</small></> : formatMoney(item.price)}</td><td data-label="Stock">{item.track_inventory ? item.inventory : 'Not tracked'}</td><td data-label="Storefront publication"><em className={statusClass(item.publication_status)}>{item.publication_status}</em></td><td data-label="Moderation visibility"><em className={statusClass(item.moderation_status)}>{item.moderation_status}</em></td><td data-label="Actions"><div className="admin-product-actions"><ProductActionMenu item={item}
              onDetails={() => setDetailsId(item.id)}
              onEdit={() => setEditing(item)}
              onModerate={(next) => void moderate(item, next)}
              onPublication={() => requestPublication(item)}
              onArchive={() => setArchiveTarget(item)}
              onDelete={() => setDeleteTarget(item)}
            /></div></td></tr>)}</tbody></table></div>}{!error && !loading && <ApiPagination page={page} pageSize={12} count={count} onPageChange={setPage} loading={loading} />}{detailsId && <AdminProductDetails id={detailsId} onClose={() => setDetailsId(null)} onEdit={(id) => { const product = items.find((item) => item.id === id); setDetailsId(null); if (product) setEditing(product) }} />}{moderationTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !moderationSaving) setModerationTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-moderation-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Product moderation</p><h3 id="product-moderation-title">{moderationTarget.next === 'hidden' ? 'Hide this product?' : moderationTarget.next === 'rejected' ? 'Reject this product?' : moderationTarget.item.moderation_status === 'pending_review' ? 'Approve this product?' : 'Unhide this product?'}</h3></div><button type="button" className="admin-icon-button" aria-label="Close confirmation" disabled={moderationSaving} onClick={() => setModerationTarget(null)}><X size={18} /></button></div><p className="admin-copy">{moderationTarget.next === 'hidden' ? `“${moderationTarget.item.name}” will be hidden from customers. Its storefront publication setting will remain unchanged.` : moderationTarget.next === 'rejected' ? `“${moderationTarget.item.name}” will be rejected. Give the vendor clear correction notes.` : moderationTarget.item.moderation_status === 'pending_review' ? `“${moderationTarget.item.name}” will be approved and published to the storefront.` : `“${moderationTarget.item.name}” will be restored to approved moderation status.`}</p>{moderationTarget.next === 'rejected' && <label className="admin-form-span"><span>Rejection reason / required corrections *</span><textarea rows={4} value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} minLength={3} required placeholder="Explain what the vendor must correct before resubmitting." /></label>}{moderationTarget.next === 'approved' && moderationTarget.item.moderation_status === 'hidden' && moderationTarget.item.publication_status !== 'published' && <label className="admin-check admin-unhide-publish-choice"><input type="checkbox" checked={publishOnUnhide} onChange={(event) => setPublishOnUnhide(event.target.checked)}/> Also publish this product to the storefront after unhiding</label>}<div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={moderationSaving} onClick={() => setModerationTarget(null)}>Cancel</button><button type="button" className="admin-button" disabled={moderationSaving || (moderationTarget.next === 'rejected' && moderationReason.trim().length < 3)} onClick={() => void confirmModeration()}>{moderationSaving ? 'Please wait…' : moderationTarget.next === 'hidden' ? 'Confirm hide' : moderationTarget.next === 'rejected' ? 'Confirm rejection' : moderationTarget.item.moderation_status === 'pending_review' ? 'Approve & publish' : 'Confirm unhide'}</button></div></section></div>}
    {publicationTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionSaving) setPublicationTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-publication-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Storefront publication</p><h3 id="product-publication-title">{publicationTarget.next === 'published' ? 'Publish product?' : 'Move product to draft?'}</h3></div><button type="button" className="admin-icon-button" aria-label="Close publication confirmation" disabled={actionSaving} onClick={() => setPublicationTarget(null)}><X size={18}/></button></div><p className="admin-copy">“{publicationTarget.item.name}” will {publicationTarget.next === 'published' ? 'become visible on the storefront, provided its moderation status is approved.' : 'be removed from the storefront. This does not change moderation status.'}</p><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={actionSaving} onClick={() => setPublicationTarget(null)}>Cancel</button><button type="button" className="admin-button" disabled={actionSaving} onClick={() => void confirmPublication()}>{actionSaving ? 'Please wait…' : publicationTarget.next === 'published' ? 'Confirm publish' : 'Confirm draft'}</button></div></section></div>}
    {archiveTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionSaving) setArchiveTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-archive-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Catalog archive</p><h3 id="product-archive-title">Archive product?</h3></div><button type="button" className="admin-icon-button" aria-label="Close archive confirmation" disabled={actionSaving} onClick={() => setArchiveTarget(null)}><X size={18}/></button></div><p className="admin-copy">“{archiveTarget.name}” will be archived and removed from the storefront.</p><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={actionSaving} onClick={() => setArchiveTarget(null)}>Cancel</button><button type="button" className="admin-button admin-button--danger" disabled={actionSaving} onClick={() => void confirmArchive()}>{actionSaving ? 'Please wait…' : 'Confirm archive'}</button></div></section></div>}
  {deleteTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionSaving) setDeleteTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-delete-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Permanent deletion</p><h3 id="product-delete-title">Delete product permanently?</h3></div><button type="button" className="admin-icon-button" onClick={() => setDeleteTarget(null)} disabled={actionSaving}><X size={18}/></button></div><p className="admin-copy">This permanently removes “{deleteTarget.name}”, its images, variants and inventory. Existing order snapshots are retained.</p><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" onClick={() => setDeleteTarget(null)} disabled={actionSaving}>Cancel</button><button type="button" className="admin-button admin-button--danger" disabled={actionSaving} onClick={async()=>{setActionSaving(true);try{await deleteAdminProductPermanently(deleteTarget.id);push('Product permanently deleted.','success');setDeleteTarget(null);load()}catch(cause){push(cause instanceof Error?cause.message:'Product could not be deleted.','error')}finally{setActionSaving(false)}}}>{actionSaving?'Deleting…':'Delete permanently'}</button></div></section></div>}
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">Vendor requests</p><h3>Product deletion requests</h3><p className="admin-copy">Vendors cannot delete listings themselves. Review each request here.</p></div><span>{deletionRequests.filter((request)=>request.status==='pending').length} pending</span></div>{deletionRequests.length===0?<p className="admin-copy">No vendor deletion requests.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Vendor</th><th>Reason</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead><tbody>{deletionRequests.map((request)=>{const product=items.find((item)=>item.id===request.product_id);return <tr key={request.id}><td><div className="admin-product-cell">{product?.image_url?<img src={product.image_url} alt=""/>:<span className="admin-thumb"><Package size={15}/></span>}<strong>{request.product_name}</strong></div></td><td>{request.shop_name}</td><td>{request.reason}</td><td><em className={statusClass(request.status)}>{request.status}</em>{request.admin_note&&<small>{request.admin_note}</small>}</td><td>{formatDate(request.created_at)}</td><td>{request.status==='pending'&&<div className="admin-action-row"><button className="admin-small-button" onClick={()=>{setDeletionReviewTarget(request);setDeletionReviewNote('')}}>Review</button></div>}</td></tr>})}</tbody></table></div>}</section>
    {deletionReviewTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!actionSaving)setDeletionReviewTarget(null)}}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-delete-review-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Vendor deletion request</p><h3 id="vendor-delete-review-title">{deletionReviewTarget.product_name}</h3></div><button className="admin-icon-button" onClick={()=>setDeletionReviewTarget(null)} disabled={actionSaving}><X size={18}/></button></div><p className="admin-copy">{deletionReviewTarget.shop_name}: {deletionReviewTarget.reason}</p><label className="admin-form-span"><span>Admin note {deletionReviewNote.length<3?'(required when declining)':''}</span><textarea rows={3} value={deletionReviewNote} onChange={(event)=>setDeletionReviewNote(event.target.value)} placeholder="Optional approval note, or required reason for declining."/></label><div className="admin-form-actions"><button className="admin-button admin-button--outline" onClick={()=>setDeletionReviewTarget(null)} disabled={actionSaving}>Cancel</button><button className="admin-button admin-button--outline" disabled={actionSaving||deletionReviewNote.trim().length<3} onClick={async()=>{setActionSaving(true);try{await reviewAdminProductDeletion(deletionReviewTarget.id,false,deletionReviewNote);push('Deletion request declined.','success');setDeletionReviewTarget(null);load()}catch(cause){push(cause instanceof Error?cause.message:'Request could not be declined.','error')}finally{setActionSaving(false)}}}>Decline</button><button className="admin-button admin-button--danger" disabled={actionSaving} onClick={async()=>{setActionSaving(true);try{await reviewAdminProductDeletion(deletionReviewTarget.id,true,deletionReviewNote);push('Product deletion approved and completed.','success');setDeletionReviewTarget(null);load()}catch(cause){push(cause instanceof Error?cause.message:'Product deletion failed.','error')}finally{setActionSaving(false)}}}>{actionSaving?'Processing…':'Approve deletion'}</button></div></section></div>}
  </section>
}


function VendorProducts({ sellerId }: { sellerId?: string }) {
  return sellerId ? <VendorProductsForSeller sellerId={sellerId} /> : <VendorProductsOverview />
}

function VendorProductsOverview() {
  const { push } = useToast()
  const [vendors, setVendors] = useState<import('../services/admin/adminService').AdminVendorDirectoryRow[]>([])
  const [sellerId, setSellerId] = useState('')
  const [items, setItems] = useState<AdminProduct[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pending_review' | 'approved' | 'rejected'>('pending_review')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminProduct | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined)

  useEffect(() => {
    void listAdminVendorDirectoryPage('', 0, 200).then((result) => setVendors(result.items)).catch(() => setVendors([]))
  }, [])
  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void Promise.all([
      listAdminProductsPage(search, page, 12, sellerId || null, tab, false),
      tab === 'pending_review' ? Promise.resolve(null) : listAdminProductsPage('', 0, 1, null, 'pending_review', false)
    ]).then(([result, pending]) => {
      setItems(result.items); setCount(result.count)
      if (pending) setPendingCount(pending.count)
      else if (tab === 'pending_review') setPendingCount(result.count)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Vendor products could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }
  useEffect(load, [search, page, tab, sellerId])
  useAutoRefresh(load)
  async function approve(item: AdminProduct) {
    setSaving(true)
    try { await moderateProduct(item.id, 'approved'); push('Vendor product approved.', 'success'); load(true) }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Product could not be approved.', 'error') }
    finally { setSaving(false) }
  }
  async function reject() {
    if (!rejectTarget || rejectReason.trim().length < 3) return
    setSaving(true)
    try { await moderateProduct(rejectTarget.id, 'rejected', rejectReason.trim()); push('Vendor product rejected.', 'success'); setRejectTarget(null); setRejectReason(''); load(true) }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Product could not be rejected.', 'error') }
    finally { setSaving(false) }
  }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Catalog management</p><h2>Vendor Products</h2><p className="admin-copy">Review vendor product approval requests separately from platform products.</p></div><button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="admin-panel">
      <div className="admin-toolbar admin-finance-toolbar">
        <div className="admin-segmented" role="tablist" aria-label="Vendor product status">
          {(['pending_review','approved','rejected'] as const).map((key) => <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => { setTab(key); setPage(0) }}>{key === 'pending_review' ? 'Pending Products' : key === 'approved' ? 'Approved Products' : 'Rejected Products'}{key === 'pending_review' && pendingCount > 0 ? ` (${pendingCount})` : ''}</button>)}
        </div>
        <select aria-label="Filter by vendor" value={sellerId} onChange={(event) => { setSellerId(event.target.value); setPage(0) }}><option value="">All vendors</option>{vendors.map((vendor) => <option key={vendor.seller_id} value={vendor.seller_id}>{vendor.shop_name}</option>)}</select>
        <label className="admin-search"><Search size={16}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search product name, SKU or slug"/></label>
      </div>
      {editing !== undefined && <ProductEditor key={editing?.id ?? 'vendor-product-edit'} product={editing ?? undefined} onSaved={() => { setEditing(undefined); load(true) }} onCancel={() => setEditing(undefined)}/>}
      {error ? <ErrorState message={error} retry={load}/> : loading ? <Loading/> : items.length === 0 ? <Empty title={tab === 'pending_review' ? 'No pending products' : tab === 'approved' ? 'No approved products' : 'No rejected products'} detail="There are no vendor products matching this status and filter."/> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>#</th><th>Product</th><th>Vendor</th><th>Category</th><th>Price</th><th>Stock</th><th>Publication</th><th>Action</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id}>
          <td>{page * 12 + index + 1}</td><td><div className="admin-product-cell">{item.image_url ? <img src={item.image_url} alt=""/> : <span className="admin-thumb"><Package size={15}/></span>}<span><strong>{item.name}</strong><small>{item.sku ?? 'No product code'} · {item.slug}</small></span></div></td>
          <td>{item.seller_name ?? 'Vendor'}</td><td>{item.category?.name ?? 'Unassigned'}</td><td>{formatMoney(item.price)}</td><td>{item.track_inventory ? item.inventory : 'Not tracked'}</td><td><em className={statusClass(item.publication_status)}>{item.publication_status}</em></td>
          <td><div className="admin-action-row"><button className="admin-small-button" onClick={() => setDetailsId(item.id)}>View</button><button className="admin-small-button" onClick={() => setEditing(item)}>Edit</button>{tab === 'pending_review' && <><button className="admin-small-button" disabled={saving} onClick={() => void approve(item)}>Approve</button><button className="admin-small-button" disabled={saving} onClick={() => { setRejectTarget(item); setRejectReason('') }}>Reject</button></>}</div></td>
        </tr>)}</tbody></table></div>}
      {!error && !loading && <ApiPagination page={page} pageSize={12} count={count} onPageChange={setPage} loading={loading}/>}
    </div>
    {detailsId && <AdminProductDetails id={detailsId} onClose={() => setDetailsId(null)} onEdit={(id) => { const item = items.find((row) => row.id === id); setDetailsId(null); if (item) setEditing(item) }}/>}
    {rejectTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRejectTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-product-reject-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Vendor product review</p><h3 id="vendor-product-reject-title">Reject {rejectTarget.name}?</h3></div><button type="button" className="admin-icon-button" disabled={saving} onClick={() => setRejectTarget(null)}><X size={18}/></button></div><label className="admin-form-span"><span>Reason / corrections required *</span><textarea rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Tell the vendor what needs to be corrected."/></label><div className="admin-form-actions"><button className="admin-button admin-button--outline" disabled={saving} onClick={() => setRejectTarget(null)}>Cancel</button><button className="admin-button" disabled={saving || rejectReason.trim().length < 3} onClick={() => void reject()}>{saving ? 'Please wait…' : 'Confirm rejection'}</button></div></section></div>}
  </section>
}

function VendorProductsForSeller({ sellerId }: { sellerId: string }) {
  const navigate = useNavigate()
  const { push } = useToast()
  const [items, setItems] = useState<AdminProduct[]>([])
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<'pending_review' | 'approved' | 'rejected'>('pending_review')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [vendorName, setVendorName] = useState('Vendor products')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminProduct | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void listAdminProductsPage(search, page, 12, sellerId, statusTab).then((result) => {
      setItems(result.items); setCount(result.count)
      if (result.items[0]?.seller_name) setVendorName(result.items[0].seller_name)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Vendor products could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }
  useEffect(load, [search, page, statusTab, sellerId])
  useAutoRefresh(load)
  async function approve(item: AdminProduct) {
    setSaving(true)
    try { await moderateProduct(item.id, 'approved'); push('Vendor product approved.', 'success'); load(true) }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Product could not be approved.', 'error') }
    finally { setSaving(false) }
  }
  async function reject() {
    if (!rejectTarget || rejectReason.trim().length < 3) return
    setSaving(true)
    try { await moderateProduct(rejectTarget.id, 'rejected', rejectReason.trim()); push('Vendor product rejected and reason saved.', 'success'); setRejectTarget(null); setRejectReason(''); load(true) }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Product could not be rejected.', 'error') }
    finally { setSaving(false) }
  }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Vendor catalog moderation</p><h2>{vendorName}</h2><p className="admin-copy">Review this vendor’s products by moderation status.</p></div><button className="admin-button admin-button--outline" onClick={() => navigate('/admin/vendor-products')}><ArrowLeft size={15}/> All vendors</button></div>
    <div className="admin-panel">
      <div className="admin-toolbar admin-finance-toolbar"><div className="admin-segmented" role="tablist" aria-label="Vendor product status">
        {(['pending_review','approved','rejected'] as const).map((key) => <button key={key} type="button" className={statusTab === key ? 'is-active' : ''} onClick={() => { setStatusTab(key); setPage(0) }}>{key === 'pending_review' ? 'Pending Products' : key === 'approved' ? 'Approved Products' : 'Rejected Products'}</button>)}
      </div><label className="admin-search"><Search size={16}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search product name, SKU or slug"/></label></div>
      {editing !== undefined && <ProductEditor key={editing?.id ?? 'vendor-product-edit'} product={editing ?? undefined} onSaved={() => { setEditing(undefined); load(true) }} onCancel={() => setEditing(undefined)}/>}
      {error ? <ErrorState message={error} retry={load}/> : loading ? <Loading/> : items.length === 0 ? <Empty title={statusTab === 'pending_review' ? 'No pending products' : statusTab === 'approved' ? 'No approved products' : 'No rejected products'} detail="There are no products for this vendor in this status."/> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Publication</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
          <td><div className="admin-product-cell">{item.image_url ? <img src={item.image_url} alt=""/> : <span className="admin-thumb"><Package size={15}/></span>}<span><strong>{item.name}</strong><small>{item.sku ?? 'No product code'} · {item.slug}</small></span></div></td>
          <td>{item.category?.name ?? 'Unassigned'}</td><td>{formatMoney(item.price)}</td><td>{item.track_inventory ? item.inventory : 'Not tracked'}</td><td><em className={statusClass(item.publication_status)}>{item.publication_status}</em></td>
          <td><div className="admin-action-row"><button className="admin-small-button" onClick={() => setDetailsId(item.id)}>View</button><button className="admin-small-button" onClick={() => setEditing(item)}>Edit</button>{statusTab === 'pending_review' && <><button className="admin-small-button" disabled={saving} onClick={() => void approve(item)}>Approve</button><button className="admin-small-button" disabled={saving} onClick={() => { setRejectTarget(item); setRejectReason('') }}>Reject</button></>}</div></td>
        </tr>)}</tbody></table></div>}
      {!error && !loading && <ApiPagination page={page} pageSize={12} count={count} onPageChange={setPage} loading={loading}/>}
    </div>
    {detailsId && <AdminProductDetails id={detailsId} onClose={() => setDetailsId(null)} onEdit={(id) => { const product = items.find((item) => item.id === id); setDetailsId(null); if (product) setEditing(product) }}/>}
    {rejectTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRejectTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-product-reject-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Vendor product review</p><h3 id="vendor-product-reject-title">Reject {rejectTarget.name}?</h3></div><button type="button" className="admin-icon-button" disabled={saving} onClick={() => setRejectTarget(null)}><X size={18}/></button></div><label className="admin-form-span"><span>Reason / corrections required *</span><textarea rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Tell the vendor what needs to be corrected."/></label><div className="admin-form-actions"><button className="admin-button admin-button--outline" disabled={saving} onClick={() => setRejectTarget(null)}>Cancel</button><button className="admin-button" disabled={saving || rejectReason.trim().length < 3} onClick={() => void reject()}>{saving ? 'Please wait…' : 'Confirm rejection'}</button></div></section></div>}
  </section>
}

function AdminProductDetails({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (id: string) => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminProductEditor>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { let active = true; setLoading(true); setError(null); void getAdminProductEditor(id).then((result) => { if (active) setDetail(result) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Product details could not be loaded.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [id, attempt])
  const product = detail?.product
  return <div className="admin-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-product-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Catalog record</p><h3 id="admin-product-title">{product?.name ?? 'Product details'}</h3></div><button className="admin-icon-button" aria-label="Close product details" onClick={onClose}><X size={18} /></button></div>{loading ? <Loading /> : error ? <div className="admin-state admin-state--error" role="alert"><CircleAlert size={18} />{error}<button className="admin-button admin-button--outline" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : !detail ? <Empty title="Product not found" detail="This product may have been removed or is no longer available to this admin account." /> : <><div className="admin-detail-gallery">{detail.images.filter((image) => image.display_url).map((image) => <img key={image.id} src={image.display_url ?? ''} alt={image.alt_text || product?.name || 'Product image'} />)}{detail.images.every((image) => !image.display_url) && <span className="admin-thumb"><Package size={24} /></span>}</div><div className="admin-drawer-section"><h4>Product information</h4><strong>{product?.name}</strong><span>{product?.description || product?.short_description || 'No description provided.'}</span><span>SKU: {product?.sku || '—'} · Slug: {product?.slug}</span><span>Category: {detail.category?.name || 'Unassigned'}</span><span>Price: {formatMoney(product?.price ?? 0)} {product?.currency}</span>{(product?.discount_percent ?? 0) > 0 && <span>Discount: {product?.discount_percent}% · Sale price {formatMoney((product?.price ?? 0) * (1 - (product?.discount_percent ?? 0) / 100))}</span>}<span>Stock: {product?.track_inventory ? detail.inventory.reduce((sum, row) => sum + Number(row.quantity), 0) : 'Inventory not tracked'}</span></div><div className="admin-drawer-section"><h4>Publication and moderation</h4><span>Publication: {product?.publication_status}</span><span>Moderation: {product?.moderation_status}</span><span>Stock verification: {product?.stock_verification_status}</span>{product?.moderation_reason && <span>Moderation reason: {product.moderation_reason}</span>}</div><div className="admin-drawer-section"><h4>Seller</h4>{detail.seller ? <><strong>{detail.seller.shop_name} · {detail.seller.status}</strong><a href={`/shops/${detail.seller.slug}`} target="_blank" rel="noreferrer">Open public shop</a></> : <span>No seller associated.</span>}</div><div className="admin-drawer-section"><h4>Food & groceries</h4>{product?.food_selling_unit ? <><span>Selling unit: {product.food_selling_unit}</span><span>Unit price: {formatMoney(product.food_unit_price ?? product.price)} / {product.food_selling_unit}</span><span>Customer quantity step: {product.food_quantity_increment ?? '—'}</span><span>Minimum purchase steps: {product.food_minimum_quantity ?? '—'}</span><span>Daily dish: {product.is_daily_item ? 'Yes' : 'No'}</span><span>Daily availability: {product.daily_status === 'available' ? 'Available today' : product.daily_status === 'coming_soon' ? 'Coming soon' : 'Not for today'}</span><span>Today’s available quantity: {product.daily_available_quantity ?? 0}</span></> : <span>Not a food product.</span>}</div><div className="admin-drawer-section"><h4>Admin financial information</h4><span>Supplier cost: {product?.supplier_cost == null ? '—' : formatMoney(product.supplier_cost)}</span><span>Fulfilment expense: {formatMoney(product?.fulfillment_expense ?? 0)}</span><span>Minimum profit: {formatMoney(product?.minimum_profit ?? 0)}</span></div><div className="admin-drawer-section"><h4>Variants and stock</h4>{detail.variants.length ? detail.variants.map((variant) => { const stock = detail.inventory.find((row) => row.variant_id === variant.id); return <div className="admin-list-row" key={variant.id}><span><strong>{variant.option_label}: {variant.option_value}</strong><small>{variant.sku || 'No SKU'} · {variant.is_active ? 'Active' : 'Inactive'}</small></span><span>{variant.price_override == null ? 'Base price' : formatMoney(variant.price_override)} · Stock {stock?.quantity ?? '—'}</span></div> }) : <span>No variants.</span>}</div><div className="admin-drawer-section"><span>Created: {formatDate(product?.created_at ?? '')}</span><span>Updated: {formatDate(product?.updated_at ?? '')}</span><button className="admin-button" onClick={() => onEdit(id)}><Edit2 size={15} /> Edit product</button></div></>}</aside></div>
}

function productSlugFromName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function productCodeFromName(value: string) {
  const slug = productSlugFromName(value)
  return slug ? `JTB-${slug.toUpperCase()}` : ''
}

function ProductEditor({ product, onSaved, onCancel }: { product?: AdminProduct; onSaved: () => void; onCancel: () => void }) {
  const { push } = useToast(); const [categories, setCategories] = useState<AdminCategory[]>([]); const [selectedCategoryId, setSelectedCategoryId] = useState(product?.category_id ?? ''); const [foodSellingUnit, setFoodSellingUnit] = useState(product?.food_selling_unit ?? 'kg'); const [foodQuantityIncrement, setFoodQuantityIncrement] = useState(String(product?.food_quantity_increment ?? 250)); const [foodMinimumQuantity, setFoodMinimumQuantity] = useState(String(product?.food_minimum_quantity ?? 1)); const [productPrice, setProductPrice] = useState(String(product?.food_unit_price ?? product?.price ?? '')); const [foodDailyItem, setFoodDailyItem] = useState(product?.is_daily_item ?? false); const [foodDailyStatus, setFoodDailyStatus] = useState(product?.daily_status ?? 'not_today'); const [foodDailyQuantity, setFoodDailyQuantity] = useState(String(product?.daily_available_quantity ?? 0)); const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminProductEditor>> | null>(null); const [detailError, setDetailError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [images, setImages] = useState<File[]>([]); const [variantRows, setVariantRows] = useState<AdminVariant[]>([]); const [stockQuantity, setStockQuantity] = useState('0'); const [variantStock, setVariantStock] = useState<Record<string, string>>({}); const [variantDeleteTarget, setVariantDeleteTarget] = useState<AdminVariant | null>(null); const [variantDeleteSaving, setVariantDeleteSaving] = useState(false); const [removingImageId, setRemovingImageId] = useState<string | null>(null); const [slugValue, setSlugValue] = useState(product?.slug ?? ''); const [skuValue, setSkuValue] = useState(product?.sku ?? ''); const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(product?.slug)); const [skuManuallyEdited, setSkuManuallyEdited] = useState(Boolean(product?.sku))
  useEffect(() => { void listAdminCategories().then(setCategories).catch(() => undefined); if (product) void getAdminProductEditor(product.id).then((next) => { if (!next) throw new Error('Product not found.'); setDetail(next); setSelectedCategoryId(next.product.category_id ?? ''); setFoodSellingUnit(next.product.food_selling_unit ?? 'kg'); setFoodQuantityIncrement(String(next.product.food_quantity_increment ?? 250)); setFoodMinimumQuantity(String(next.product.food_minimum_quantity ?? 1)); setProductPrice(String(next.product.food_unit_price ?? next.product.price)); setFoodDailyItem(next.product.is_daily_item ?? false); setFoodDailyStatus(next.product.daily_status ?? 'not_today'); setFoodDailyQuantity(String(next.product.daily_available_quantity ?? 0)); setVariantRows(next.variants); setStockQuantity(next.product.track_inventory ? String(next.inventory.find((row) => !row.variant_id)?.quantity ?? 0) : ''); setVariantStock(Object.fromEntries(next.variants.map((row) => [row.id, String(next.inventory.find((entry) => entry.variant_id === row.id)?.quantity ?? 0)]))) }).catch((cause: unknown) => setDetailError(cause instanceof Error ? cause.message : 'Product details could not be loaded.')) }, [product, push])
  if (product && !detail) return <div className="admin-panel">{detailError ? <div className="admin-state admin-state--error" role="alert">{detailError}</div> : <Loading />}</div>
  const current = detail?.product ?? product
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  const isFoodCategory = (() => { let currentCategory = selectedCategory; while (currentCategory) { if (currentCategory.is_food_category) return true; currentCategory = currentCategory.parent_id ? categories.find((category) => category.id === currentCategory?.parent_id) : undefined } return Boolean(current?.food_selling_unit || current?.is_daily_item) })(); const isOptionalFoodStock = ['fast-food', 'homemade-food'].includes(selectedCategory?.slug ?? '')
  const foodUnitOptions = [{ value: 'kg', label: 'Kilogram (kg)' }, { value: 'g', label: 'Gram (g)' }, { value: 'l', label: 'Litre (L)' }, { value: 'ml', label: 'Millilitre (ml)' }, { value: 'piece', label: 'Piece' }, { value: 'dozen', label: 'Dozen' }, { value: 'pack', label: 'Pack' }]
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const currentImageCount = detail?.images.filter((image) => Boolean(image.display_url)).length ?? 0; if (currentImageCount + images.length < 1) { push('Upload at least one product image before saving.', 'error'); return } const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim(); const slug = String(data.get('slug') ?? '').trim(); const enteredPrice = Number(data.get('price')); const foodUnit = isFoodCategory || Boolean(current?.food_selling_unit) ? foodSellingUnit : null; const foodIncrement = Number(foodQuantityIncrement); const foodMinimum = Number(foodMinimumQuantity); const foodDivisor = foodUnit === 'kg' || foodUnit === 'l' ? 1000 : 1; const price = foodUnit ? Number((enteredPrice * foodIncrement / foodDivisor).toFixed(2)) : enteredPrice; const discountPercent = Number(data.get('discount_percent') ?? 0); const supplierCost = data.get('supplier_cost') === '' ? null : Number(data.get('supplier_cost')); const fulfillmentExpense = Number(data.get('fulfillment_expense') ?? 0); const minimumProfit = Number(data.get('minimum_profit') ?? 0); const desiredPublicationStatus = String(data.get('publication_status') ?? 'draft') as Database['public']['Tables']['products']['Row']['publication_status']; const savePublicationStatus = desiredPublicationStatus === 'published' && (!current || current.publication_status !== 'published') ? 'draft' : desiredPublicationStatus; if (!name || !slug || !Number.isFinite(enteredPrice) || enteredPrice < 0 || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || (supplierCost !== null && (!Number.isFinite(supplierCost) || supplierCost < 0)) || !Number.isFinite(fulfillmentExpense) || fulfillmentExpense < 0 || !Number.isFinite(minimumProfit) || minimumProfit < 0 || enteredPrice < (supplierCost ?? 0) + fulfillmentExpense + minimumProfit || (isFoodCategory && (!Number.isInteger(foodIncrement) || foodIncrement < 1 || !Number.isInteger(foodMinimum) || foodMinimum < 1))) { push('Enter a valid name, slug, price, and a discount between 0 and 100%.', 'error'); return } const trackInventory = isOptionalFoodStock ? (stockQuantity.trim() !== '' || (variantRows.length > 0 && variantRows.some((row) => (variantStock[row.id] ?? '').trim() !== ''))) : data.get('track_inventory') === 'on'; const stockValues = variantRows.length ? variantRows.map((row) => Number(variantStock[row.id] ?? '0')) : [Number(stockQuantity)]; if (trackInventory && stockValues.some((value) => !Number.isInteger(value) || value < 0)) { push('Every product and variant stock value must be a whole number of zero or more.', 'error'); return } let specifications: unknown = []; let dimensions: unknown = {}; try { specifications = JSON.parse(String(data.get('specifications') || '[]')); dimensions = JSON.parse(String(data.get('dimensions') || '{}')) } catch { push('Specifications and dimensions must be valid JSON.', 'error'); return } setSaving(true); try { const saved = await saveProduct({ name, slug, price, discount_percent: discountPercent, food_unit_price: foodUnit ? enteredPrice : null, food_selling_unit: foodUnit, food_quantity_increment: foodUnit ? foodIncrement : null, food_minimum_quantity: foodUnit ? foodMinimum : null, is_daily_item: Boolean(foodUnit && foodDailyItem), daily_available_quantity: foodUnit && foodDailyItem && foodDailyStatus === 'available' ? Number(foodDailyQuantity || 0) : 0, daily_minimum_quantity: foodUnit && foodDailyItem ? foodMinimum : 1, daily_status: foodUnit && foodDailyItem ? foodDailyStatus : 'available', currency: 'PKR', supplier_cost: supplierCost, fulfillment_expense: fulfillmentExpense, minimum_profit: minimumProfit, short_description: String(data.get('short_description') ?? ''), description: String(data.get('description') ?? ''), publication_status: savePublicationStatus, is_featured: data.get('is_featured') === 'on', track_inventory: trackInventory, category_id: String(data.get('category_id') || '') || null, specifications: specifications as Database['public']['Tables']['products']['Insert']['specifications'], dimensions: dimensions as Database['public']['Tables']['products']['Insert']['dimensions'], sku: String(data.get('sku') ?? '') || null, weight_grams: data.get('weight_grams') ? Number(data.get('weight_grams')) : null, seo_title: String(data.get('seo_title') ?? '') || null, seo_description: String(data.get('seo_description') ?? '') || null }, current?.id); if (!saved) throw new Error('The product was not returned after saving.'); for (const image of images) await uploadAdditionalProductImage(saved.id, image, saved.publication_status !== 'published'); for (const row of variantRows) { const savedVariant = await saveProductVariant({ product_id: saved.id, option_label: row.option_label, option_value: row.option_value, sku: row.sku, price_override: row.price_override, attributes: row.attributes, is_active: row.is_active, sort_order: row.sort_order }, row.id.startsWith('new-') ? undefined : row.id); if (!savedVariant) throw new Error(`Variant ${row.option_label}: ${row.option_value} could not be saved.`); if (data.get('track_inventory') === 'on') await saveAdminProductInventory(saved.id, savedVariant.id, Number(variantStock[row.id] ?? '0')) } const isDailyDish = Boolean(foodUnit && foodDailyItem); if (variantRows.length === 0 && (data.get('track_inventory') === 'on' || isDailyDish)) await saveAdminProductInventory(saved.id, null, isDailyDish ? (foodDailyStatus === 'available' ? Number(foodDailyQuantity || 0) : 0) : Number(stockQuantity)); if (desiredPublicationStatus === 'published' && saved.publication_status !== 'published') await updateProductStatus(saved.id, 'published'); push(current ? 'Product changes saved.' : 'Draft product created.'); onSaved() } catch (cause) { push(cause instanceof Error ? cause.message : 'Product could not be saved.', 'error') } finally { setSaving(false) } }
  async function removeCurrentImage(image: NonNullable<typeof detail>['images'][number]) {
    if (!current?.id || removingImageId) return
    if (!window.confirm('Remove this image from the product? This cannot be undone.')) return
    setRemovingImageId(image.id)
    try {
      await deleteAdminProductImage(image.id, current.id)
      setDetail((previous) => previous ? { ...previous, images: previous.images.filter((item) => item.id !== image.id) } : previous)
      push('Product image removed.', 'success')
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Product image could not be removed.', 'error')
    } finally {
      setRemovingImageId(null)
    }
  }
  function addVariant() { const id = `new-${crypto.randomUUID()}`; setVariantStock((stock) => ({ ...stock, [id]: '0' })); setVariantRows((rows) => [...rows, { id, product_id: current?.id ?? '', option_label: 'Option', option_value: '', sku: null, price_override: null, attributes: {}, is_active: true, sort_order: rows.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]) }
  function updateVariant(id: string, patch: Partial<AdminVariant>) { setVariantRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row)) }
  async function removeVariant(row: AdminVariant) { if (row.id.startsWith('new-')) { setVariantRows((rows) => rows.filter((item) => item.id !== row.id)); return } setVariantDeleteTarget(row) }
  return <><form className="admin-form admin-panel" onSubmit={(event) => void submit(event)}><div className="admin-panel-heading"><div><p className="admin-kicker">{current ? 'Edit catalog record' : 'Create safely'}</p><h3>{current ? current.name : 'New product draft'}</h3></div><button type="button" className="admin-icon-button" onClick={onCancel}><X size={18} /></button></div><div className="admin-form-grid"><label>Product name<input name="name" defaultValue={current?.name ?? ''} required onChange={(event) => { const nextName = event.target.value; if (!slugManuallyEdited) setSlugValue(productSlugFromName(nextName)); if (!skuManuallyEdited) setSkuValue(productCodeFromName(nextName)) }} /></label><label>Product URL<input name="slug" value={slugValue} onChange={(event) => { setSlugManuallyEdited(true); setSlugValue(productSlugFromName(event.target.value)) }} placeholder="product-name" required /><small>Created automatically from the product name. You can edit it if needed.</small></label><label>{isFoodCategory ? `Price per ${foodSellingUnit} (PKR)` : 'Price (PKR)'}<input name="price" type="number" min="0" step="0.01" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required /></label><label>Discount (%)<input name="discount_percent" type="number" min="0" max="100" step="0.01" defaultValue={current?.discount_percent ?? 0} /><small>Enter 0 for no discount, or 1–100.</small></label><label>Product code<input name="sku" value={skuValue} onChange={(event) => { setSkuManuallyEdited(true); setSkuValue(event.target.value) }} placeholder="JTB-PRODUCT-NAME" /><small>JTBazar creates this code automatically. You do not need to enter one yourself.</small></label><label>Category<select name="category_id" value={selectedCategoryId} onChange={(event) => { const nextId = event.target.value; let nextCategory = categories.find((category) => category.id === nextId); let nextIsFood = false; while (nextCategory) { if (nextCategory.is_food_category) { nextIsFood = true; break } nextCategory = nextCategory.parent_id ? categories.find((category) => category.id === nextCategory?.parent_id) : undefined } setSelectedCategoryId(nextId); const nextSlug = categories.find((category) => category.id === nextId)?.slug; if (['fast-food', 'homemade-food'].includes(nextSlug ?? '')) setStockQuantity(''); else if (['fast-food', 'homemade-food'].includes(selectedCategory?.slug ?? '') && !current?.track_inventory) setStockQuantity('0'); if (!nextIsFood && current?.food_selling_unit) setProductPrice(String(current.price)); else if (nextIsFood && current?.food_unit_price != null) setProductPrice(String(current.food_unit_price)) }}><option value="">Unassigned</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_food_category ? ' · Food' : ''}</option>)}</select></label>{isFoodCategory && <section className="admin-form-span admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">Food & groceries</p><h4>Food selling unit</h4></div></div><label>Selling unit<select value={foodSellingUnit} onChange={(event) => { const next = event.target.value; setFoodSellingUnit(next); setFoodQuantityIncrement(next === 'kg' || next === 'l' ? '250' : next === 'g' || next === 'ml' ? '100' : '1') }}>{foodUnitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label><label>Customer quantity step<input type="number" min="1" step="1" value={foodQuantityIncrement} onChange={(event) => setFoodQuantityIncrement(event.target.value)} /><small>For kg/litre the step is grams/ml; for dozen, piece and pack it is units.</small></label><label>Minimum purchase steps<input type="number" min="1" step="1" value={foodMinimumQuantity} onChange={(event) => setFoodMinimumQuantity(event.target.value)} /></label><label className="admin-check"><input name="is_daily_item" type="checkbox" checked={foodDailyItem} onChange={(event) => setFoodDailyItem(event.target.checked)} /> Manage as a daily dish / daily food item</label>{(foodDailyItem || isFoodCategory) && <><label>Daily availability status<select name="daily_status" value={foodDailyStatus} onChange={(event) => setFoodDailyStatus(event.target.value as typeof foodDailyStatus)}><option value="available">Available today</option><option value="not_today">Not for today</option><option value="coming_soon">Coming soon</option></select></label><label>Today’s available quantity<input name="daily_available_quantity" type="number" min="0" step="1" value={foodDailyQuantity} onChange={(event) => setFoodDailyQuantity(event.target.value)} /></label></>}</section>}<label>Publication<select name="publication_status" defaultValue={current?.publication_status ?? 'draft'}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label className="admin-form-span"><span>Short description</span><input name="short_description" defaultValue={current?.short_description ?? ''} /></label><label className="admin-form-span"><span>Description</span><textarea name="description" rows={5} defaultValue={current?.description ?? ''} /></label><label>Weight (grams)<input name="weight_grams" type="number" min="0" defaultValue={current?.weight_grams ?? ''} /></label><label>Supplier cost (private)<input name="supplier_cost" type="number" min="0" step="0.01" defaultValue={current?.supplier_cost ?? ''} /></label><label>Fulfilment expense<input name="fulfillment_expense" type="number" min="0" step="0.01" defaultValue={current?.fulfillment_expense ?? 0} /></label><label>Minimum profit<input name="minimum_profit" type="number" min="0" step="0.01" defaultValue={current?.minimum_profit ?? 0} /></label><label className="admin-form-span"><span>Specifications JSON</span><textarea name="specifications" rows={3} defaultValue={JSON.stringify(current?.specifications ?? [], null, 2)} /></label><label className="admin-form-span"><span>Dimensions JSON</span><textarea name="dimensions" rows={3} defaultValue={JSON.stringify(current?.dimensions ?? {}, null, 2)} /></label><label>SEO title<input name="seo_title" defaultValue={current?.seo_title ?? ''} /></label><label>SEO description<input name="seo_description" defaultValue={current?.seo_description ?? ''} /></label>{detail?.images.length ? <div className="admin-form-span"><span>Current images</span><div className="admin-product-image-previews">{detail.images.map((image) => image.display_url ? <div className="admin-product-image-preview" key={image.id}><img src={image.display_url} alt={image.alt_text || current?.name || 'Product image'} /><button type="button" className="admin-icon-button admin-product-image-remove" aria-label="Remove product image" title="Remove image" disabled={removingImageId !== null} onClick={() => void removeCurrentImage(image)}><X size={14} /></button>{image.is_primary && <small>Primary</small>}</div> : null)}</div></div> : null}<label className="admin-form-span"><span>Product images * (up to 8 total; JPG, PNG, WebP or AVIF, max 10 MB each)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const existingCount = detail?.images.length ?? 0; const remaining = Math.max(0, 8 - existingCount - images.length); const valid = selected.filter((file) => file.size <= 10 * 1024 * 1024 && ['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)); if (valid.length !== selected.length) push('Only JPG, PNG, WebP or AVIF images up to 10 MB each are allowed.', 'error'); if (selected.length > remaining) push('You can add up to 8 product images in total.', 'error'); setImages((current) => [...current, ...valid.slice(0, remaining)]); event.target.value = '' }} />{images.length > 0 && <div className="admin-product-image-previews">{images.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="admin-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setImages((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X size={14} /></button></div>)}</div>}{images.length > 0 && <small>{images.length} new image{images.length === 1 ? '' : 's'} selected.</small>}<small>Required: keep or upload at least one product image before saving.</small></label><label className="admin-check"><input name="is_featured" type="checkbox" defaultChecked={current?.is_featured ?? false} /> Featured</label>{!isOptionalFoodStock && <label className="admin-check"><input name="track_inventory" type="checkbox" defaultChecked={current?.track_inventory ?? true} /> Track inventory <small>When enabled, stock is checked at checkout.</small></label>}{variantRows.length === 0 && <label>{isOptionalFoodStock ? 'Available stock (optional)' : 'Available stock'}<input name="initial_stock" type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder={isOptionalFoodStock ? 'Leave blank to keep In Stock without quantity' : '0'} /><small>{isOptionalFoodStock ? 'Blank = always shown In Stock; enter a quantity only when you want the customer to see stock count and checkout stock limits.' : 'Base product quantity.'}</small></label>}</div><div className="admin-variants"><div className="admin-panel-heading"><div><p className="admin-kicker">Optional product choices</p><h4>Variants</h4></div><button type="button" className="admin-small-button" onClick={addVariant}><Plus size={13} /> Add variant</button></div>{variantRows.length === 0 ? <p className="admin-copy">No variants configured. Leave this empty for a single-SKU product.</p> : variantRows.map((row) => <div className="admin-variant-row" key={row.id}><input aria-label="Option label" value={row.option_label} onChange={(event) => updateVariant(row.id, { option_label: event.target.value })} placeholder="Size" /><input aria-label="Option value" value={row.option_value} onChange={(event) => updateVariant(row.id, { option_value: event.target.value })} placeholder="A4" /><input aria-label="Variant SKU" value={row.sku ?? ''} onChange={(event) => updateVariant(row.id, { sku: event.target.value || null })} placeholder="SKU" /><input aria-label="Variant price override" type="number" min="0" step="0.01" value={row.price_override ?? ''} onChange={(event) => updateVariant(row.id, { price_override: event.target.value ? Number(event.target.value) : null })} placeholder="Price override" /><input aria-label={`Stock for ${row.option_label} ${row.option_value}`} type="number" min="0" step="1" value={variantStock[row.id] ?? '0'} onChange={(event) => setVariantStock((stock) => ({ ...stock, [row.id]: event.target.value }))} placeholder="Stock" /><button type="button" className="admin-icon-button" onClick={() => void removeVariant(row)}><X size={15} /></button></div>)}</div><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" onClick={onCancel}>Cancel</button><button className="admin-button" disabled={saving}>{saving ? 'Saving…' : current ? 'Save product' : 'Create draft'}</button></div></form>
  {variantDeleteTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!variantDeleteSaving)setVariantDeleteTarget(null)}}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="variant-delete-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Product option</p><h3 id="variant-delete-title">Delete this variant?</h3></div><button type="button" className="admin-icon-button" onClick={()=>setVariantDeleteTarget(null)} disabled={variantDeleteSaving}><X size={18}/></button></div><p className="admin-copy">{variantDeleteTarget.option_label}: {variantDeleteTarget.option_value} will be removed from this product.</p><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" onClick={()=>setVariantDeleteTarget(null)} disabled={variantDeleteSaving}>Cancel</button><button type="button" className="admin-button admin-button--danger" disabled={variantDeleteSaving} onClick={async()=>{setVariantDeleteSaving(true);try{await deleteProductVariant(variantDeleteTarget.id);setVariantRows((rows)=>rows.filter((item)=>item.id!==variantDeleteTarget.id));setVariantDeleteTarget(null);push('Variant deleted.','success')}catch(cause){push(cause instanceof Error?cause.message:'Variant could not be deleted.','error')}finally{setVariantDeleteSaving(false)}}}>{variantDeleteSaving?'Deleting…':'Delete variant'}</button></div></section></div>}</>
}

type ProductCampaignAdminRow = {
  id: string
  name: string
  campaign_type: 'flash_sale' | 'bogo' | 'bundle' | 'seasonal' | 'custom'
  status: 'draft' | 'active' | 'paused' | 'archived'
  display_title: string
  description: string | null
  discount_percent: number
  buy_quantity: number
  get_quantity: number
  bundle_price: number | null
  starts_at: string | null
  ends_at: string | null
  product_campaign_items?: { product_id: string }[]
}

function HotDeals() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminProduct[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'all' | 'deals'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [discount, setDiscount] = useState('20')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<ProductCampaignAdminRow[]>([])
  const [campaignType, setCampaignType] = useState<ProductCampaignAdminRow['campaign_type']>('flash_sale')
  const [campaignName, setCampaignName] = useState('')
  const [campaignTitle, setCampaignTitle] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignDiscount, setCampaignDiscount] = useState('20')
  const [buyQuantity, setBuyQuantity] = useState('1')
  const [getQuantity, setGetQuantity] = useState('1')
  const [bundlePrice, setBundlePrice] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [campaignProductIds, setCampaignProductIds] = useState<string[]>([])
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)

  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void Promise.all([
      listAdminProducts(search),
      (getSupabase() as any).from('product_campaigns')
        .select('id,name,campaign_type,status,display_title,description,discount_percent,buy_quantity,get_quantity,bundle_price,starts_at,ends_at,product_campaign_items(product_id)')
        .order('created_at', { ascending: false }),
    ]).then(([rows, campaignResult]) => {
      if (campaignResult.error) throw new Error(campaignResult.error.message)
      setItems(rows)
      setCampaigns((campaignResult.data ?? []) as ProductCampaignAdminRow[])
      setSelected((current) => current.filter((id) => rows.some((row) => row.id === id)))
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Campaign data could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }
  useEffect(() => { load() }, [search])
  useAutoRefresh(load)

  const eligible = items.filter((item) => item.publication_status === 'published' && item.moderation_status === 'approved' && (!item.track_inventory || item.inventory > 0) && Number(item.discount_percent) === 0)
  const removableDeals = items.filter((item) => Number(item.discount_percent) > 0)
  const visible = view === 'deals' ? items.filter((item) => Number(item.discount_percent) > 0) : items.filter((item) => Number(item.discount_percent) === 0)
  const visibleEligible = view === 'deals' ? visible.filter((item) => removableDeals.some((row) => row.id === item.id)) : visible.filter((item) => eligible.some((row) => row.id === item.id))
  const activeCount = items.filter((item) => item.discount_percent > 0).length
  const selectedEligible = selected.filter((id) => (view === 'deals' ? removableDeals : eligible).some((item) => item.id === id))
  const campaignEligible = items.filter((item) => (item.publication_status === 'published' && item.moderation_status === 'approved' && (!item.track_inventory || item.inventory > 0) && Number(item.discount_percent) === 0) || (editingCampaignId != null && (campaigns.find((row) => row.id === editingCampaignId)?.product_campaign_items ?? []).some((link) => link.product_id === item.id)))
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  function toggleCampaignProduct(id: string) { setCampaignProductIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  function toggleAll() {
    const ids = visibleEligible.map((item) => item.id)
    setSelected((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])))
  }
  async function applyDeal(value: number) {
    if (view === 'deals' && value > 0) { push('Remove existing deals here, or switch to Available products to create a new deal.', 'error'); return }
    if (!selectedEligible.length) { push('Select at least one eligible product first.', 'error'); return }
    setSaving(true)
    try {
      await updateProductsHotDeal(selectedEligible, value)
      setItems((current) => current.map((item) => selectedEligible.includes(item.id) ? { ...item, discount_percent: value } : item))
      setSelected([])
      push(value === 0 ? 'Hot deal discounts removed from selected products.' : `Hot deal of ${value}% applied to ${selectedEligible.length} products.`, 'success')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Hot deal could not be saved.', 'error'); load(true) }
    finally { setSaving(false) }
  }
  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!campaignName.trim() || !campaignTitle.trim()) { push('Enter a campaign name and storefront title.', 'error'); return }
    if (!campaignProductIds.length) { push('Select at least one eligible product.', 'error'); return }
    const existingCampaignProductIds = editingCampaignId ? campaigns.find((row) => row.id === editingCampaignId)?.product_campaign_items?.map((row) => row.product_id) ?? [] : []
    if (campaignProductIds.some((id) => !campaignEligible.some((item) => item.id === id) && !existingCampaignProductIds.includes(id))) { push('Select published, approved, in-stock products without another active discount.', 'error'); return }
    if (campaignType === 'bundle' && campaignProductIds.length < 2) { push('A bundle must include at least two different products.', 'error'); return }
    if (['flash_sale','seasonal','custom'].includes(campaignType) && (Number(campaignDiscount) < 1 || Number(campaignDiscount) > 90)) { push('Campaign discount must be between 1% and 90%.', 'error'); return }
    if (campaignType === 'bogo' && (!Number.isInteger(Number(buyQuantity)) || !Number.isInteger(Number(getQuantity)) || Number(buyQuantity) < 1 || Number(buyQuantity) > 99 || Number(getQuantity) < 1 || Number(getQuantity) > 99)) { push('BOGO quantities must be between 1 and 99.', 'error'); return }
    if (campaignType === 'bundle') {
      const baseTotal = campaignProductIds.reduce((sum, id) => sum + Number(campaignEligible.find((item) => item.id === id)?.price ?? 0), 0)
      if (!Number.isFinite(Number(bundlePrice)) || Number(bundlePrice) <= 0 || Number(bundlePrice) >= baseTotal) { push('Bundle price must be positive and lower than the selected products total.', 'error'); return }
    }
    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) { push('Campaign end must be after its start.', 'error'); return }
    setCampaignSaving(true)
    const client = getSupabase() as any
    try {
      const { data: userData, error: userError } = await client.auth.getUser()
      if (userError) throw userError
      const payload = {
        name: campaignName.trim(),
        campaign_type: campaignType,
        status: 'active',
        display_title: campaignTitle.trim(),
        description: campaignDescription.trim() || null,
        discount_percent: ['flash_sale','seasonal','custom'].includes(campaignType) ? Number(campaignDiscount) : 0,
        buy_quantity: campaignType === 'bogo' ? Number(buyQuantity) : 1,
        get_quantity: campaignType === 'bogo' ? Number(getQuantity) : 1,
        bundle_price: campaignType === 'bundle' ? Number(bundlePrice) : null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        created_by: userData.user?.id ?? null,
      }
      let campaignId = editingCampaignId
      if (campaignId) {
        const { error: updateError } = await client.from('product_campaigns').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', campaignId)
        if (updateError) throw updateError
        const { error: removeLinksError } = await client.from('product_campaign_items').delete().eq('campaign_id', campaignId)
        if (removeLinksError) throw removeLinksError
      } else {
        const { data: created, error: createError } = await client.from('product_campaigns').insert(payload).select('id').single()
        if (createError) throw createError
        campaignId = created.id
      }
      const { error: itemError } = await client.from('product_campaign_items').insert(campaignProductIds.map((product_id) => ({ campaign_id: campaignId, product_id })))
      if (itemError) throw itemError
      setCampaignName(''); setCampaignTitle(''); setCampaignDescription(''); setCampaignDiscount('20')
      setBuyQuantity('1'); setGetQuantity('1'); setBundlePrice(''); setStartsAt(''); setEndsAt(''); setCampaignProductIds([]); setEditingCampaignId(null)
      push(editingCampaignId ? 'Campaign updated successfully.' : 'Campaign created. It will appear on the website during its scheduled active window.', 'success')
      load(true)
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Campaign could not be created.', 'error') }
    finally { setCampaignSaving(false) }
  }
  async function updateCampaignStatus(id: string, status: ProductCampaignAdminRow['status']) {
    try {
      const { error } = await (getSupabase() as any).from('product_campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setCampaigns((rows) => rows.map((row) => row.id === id ? { ...row, status } : row))
      push(`Campaign ${status}.`, 'success')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Campaign status could not be updated.', 'error') }
  }
  async function deleteCampaign(id: string) {
    if (!window.confirm('Delete this campaign and its product links?')) return
    try {
      const { error } = await (getSupabase() as any).from('product_campaigns').delete().eq('id', id)
      if (error) throw error
      setCampaigns((rows) => rows.filter((row) => row.id !== id))
      push('Campaign deleted.', 'success')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Campaign could not be deleted.', 'error') }
  }

  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Campaign pricing</p><h2>Campaign Manager</h2><p className="admin-copy">Create Hot Deals, Flash Sales, BOGO, Bundle and seasonal campaigns. Every product receives only its single best offer at checkout.</p></div><button type="button" className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="admin-metrics"><Metric label="Products in catalog" value={items.length}/><Metric label="Active product discounts" value={activeCount}/><Metric label="Campaigns" value={campaigns.length}/><Metric label="Eligible products" value={campaignEligible.length}/></div>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">{editingCampaignId ? 'Edit campaign' : 'Create campaign'}</p><h3>{editingCampaignId ? 'Update website campaign' : 'New website campaign'}</h3><p className="admin-copy">Create one campaign for multiple products, or edit an existing campaign and change its products, offer and schedule.</p></div>{editingCampaignId && <button type="button" className="admin-button admin-button--outline" onClick={() => { setEditingCampaignId(null); setCampaignProductIds([]); setCampaignName(''); setCampaignTitle(''); setCampaignDescription(''); setCampaignDiscount('20'); setStartsAt(''); setEndsAt(''); setCampaignType('flash_sale') }}>Cancel edit</button>}</div>
      <form onSubmit={createCampaign} className="admin-form admin-form-grid">
        <label className="admin-field"><span>Campaign type</span><select value={campaignType} onChange={(event) => setCampaignType(event.target.value as ProductCampaignAdminRow['campaign_type'])}><option value="flash_sale">Flash Sale</option><option value="bogo">Buy One Get One (BOGO)</option><option value="bundle">Bundle Deal</option><option value="seasonal">Seasonal (Eid / Ramadan / 11.11)</option><option value="custom">Custom campaign</option></select></label>
        <label className="admin-field"><span>Internal campaign name</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="e.g. 11.11 Kitchen Sale" maxLength={120} required/></label>
        <label className="admin-field"><span>Website section title</span><input value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} placeholder="e.g. 11.11 Mega Deals" maxLength={120} required/></label>
        <label className="admin-field"><span>Short description</span><input value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} placeholder="Limited-time offers on selected products" maxLength={300}/></label>
        {['flash_sale','seasonal','custom'].includes(campaignType) && <label className="admin-field"><span>Discount percentage</span><input type="number" min="1" max="90" value={campaignDiscount} onChange={(event) => setCampaignDiscount(event.target.value)} required/></label>}
        {campaignType === 'bogo' && <><label className="admin-field"><span>Buy quantity</span><input type="number" min="1" max="99" value={buyQuantity} onChange={(event) => setBuyQuantity(event.target.value)}/></label><label className="admin-field"><span>Free quantity</span><input type="number" min="1" max="99" value={getQuantity} onChange={(event) => setGetQuantity(event.target.value)}/></label></>}
        {campaignType === 'bundle' && <label className="admin-field"><span>Bundle price (PKR, for one of each selected product)</span><input type="number" min="1" step="0.01" value={bundlePrice} onChange={(event) => setBundlePrice(event.target.value)} required/></label>}
        <label className="admin-field"><span>Starts at (optional)</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)}/></label>
        <label className="admin-field"><span>Ends at (optional)</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)}/></label>
        <div className="admin-field admin-field--wide"><span>Select products ({campaignProductIds.length} selected)</span><div className="admin-toolbar"><span className="admin-copy">Only published, approved, in-stock products with no existing discount are available.</span><button type="button" className="admin-button admin-button--outline" onClick={() => setCampaignProductIds(campaignProductIds.length === campaignEligible.length ? [] : campaignEligible.map((item) => item.id))}>Select all eligible</button></div><div className="admin-campaign-product-picker">{campaignEligible.map((item) => <label key={item.id} className="admin-campaign-product-option"><input type="checkbox" checked={campaignProductIds.includes(item.id)} onChange={() => toggleCampaignProduct(item.id)}/><span>{item.name}<small>{formatMoney(item.price)} · {item.sku ?? 'No SKU'}</small></span></label>)}{campaignEligible.length === 0 && <p className="admin-copy">No eligible products found. Remove an existing discount or publish an approved in-stock product first.</p>}</div></div>
        <div className="admin-form-actions admin-field--wide"><button type="submit" className="admin-button" disabled={campaignSaving || !campaignProductIds.length}>{campaignSaving ? 'Saving campaign…' : editingCampaignId ? 'Save campaign changes' : 'Create campaign'}</button></div>
      </form>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Campaign library</p><h3>Existing campaigns</h3><p className="admin-copy">Pause, resume or archive a campaign. Only active campaigns inside their date window appear on the website and apply at checkout.</p></div></div>
      {campaigns.length === 0 ? <Empty title="No product campaigns yet" detail="Create your first Flash Sale, BOGO, Bundle or seasonal campaign above."/> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Offer</th><th>Products</th><th>Schedule</th><th>Status</th><th>Actions</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.display_title}</strong><small>{campaign.name}</small></td><td>{campaign.campaign_type === 'bogo' ? `Buy ${campaign.buy_quantity} Get ${campaign.get_quantity}` : campaign.campaign_type === 'bundle' ? `Bundle ${formatMoney(Number(campaign.bundle_price || 0))}` : `${Number(campaign.discount_percent)}% off`}<small>{campaign.campaign_type.replace('_',' ')}</small></td><td>{campaign.product_campaign_items?.length ?? 0} products</td><td><small>{campaign.starts_at ? new Date(campaign.starts_at).toLocaleString() : 'Starts immediately'}</small><small>{campaign.ends_at ? new Date(campaign.ends_at).toLocaleString() : 'No end date'}</small></td><td><em className={statusClass(campaign.status)}>{campaign.status}</em></td><td><div className="admin-action-row"><button type="button" className="admin-button admin-button--outline" onClick={() => { setEditingCampaignId(campaign.id); setCampaignName(campaign.name); setCampaignTitle(campaign.display_title); setCampaignDescription(campaign.description ?? ''); setCampaignType(campaign.campaign_type); setCampaignDiscount(String(campaign.discount_percent || 20)); setBuyQuantity(String(campaign.buy_quantity || 1)); setGetQuantity(String(campaign.get_quantity || 1)); setBundlePrice(campaign.bundle_price == null ? '' : String(campaign.bundle_price)); setStartsAt(campaign.starts_at ? new Date(campaign.starts_at).toISOString().slice(0,16) : ''); setEndsAt(campaign.ends_at ? new Date(campaign.ends_at).toISOString().slice(0,16) : ''); setCampaignProductIds(campaign.product_campaign_items?.map((row) => row.product_id) ?? []); window.scrollTo({top:0,behavior:'smooth'}) }}>Edit</button>{campaign.status === 'active' ? <button type="button" className="admin-button admin-button--outline" onClick={() => void updateCampaignStatus(campaign.id,'paused')}>Pause</button> : <button type="button" className="admin-button admin-button--outline" onClick={() => void updateCampaignStatus(campaign.id,'active')}>Activate</button>}<button type="button" className="admin-button admin-button--outline" onClick={() => void updateCampaignStatus(campaign.id,'archived')}>Archive</button><button type="button" className="admin-button admin-button--danger" onClick={() => void deleteCampaign(campaign.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    </section>

    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Product discounts</p><h3>{view === 'deals' ? 'Review or remove existing deals' : 'Manage existing Hot Deals and Featured Products'}</h3><p className="admin-copy">Products with an existing percentage discount are kept out of the available-products list. Set 0% to remove a selected deal.</p></div></div>
      <div className="admin-toolbar"><label className="admin-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name or SKU"/></label><div className="admin-action-row"><select aria-label="Discount percentage" value={discount} onChange={(event) => setDiscount(event.target.value)}><option value="10">10% off</option><option value="15">15% off</option><option value="20">20% off</option><option value="25">25% off</option><option value="30">30% off</option><option value="35">35% off</option><option value="40">40% off</option><option value="50">50% off</option><option value="60">60% off</option><option value="70">70% off</option><option value="75">75% off</option><option value="80">80% off</option><option value="90">90% off</option></select></div><button type="button" className="admin-button" disabled={saving || !selectedEligible.length || view === 'deals'} onClick={() => void applyDeal(Number(discount))}>{saving ? 'Applying…' : `Apply ${discount}% Hot Deal`}</button><button type="button" className="admin-button admin-button--outline" disabled={saving || !selectedEligible.length} onClick={() => void applyDeal(0)}>Remove deal</button></div>
      <div className="admin-toolbar"><div className="admin-action-row"><button type="button" className={view === 'all' ? 'admin-button' : 'admin-button admin-button--outline'} onClick={() => { setView('all'); setSelected([]) }}>Available products ({eligible.length})</button><button type="button" className={view === 'deals' ? 'admin-button' : 'admin-button admin-button--outline'} onClick={() => { setView('deals'); setSelected([]) }}>Active deals ({activeCount})</button></div><span className="admin-copy">Use Active deals to review/remove existing discounts. Featured marking is independent.</span></div>
      {error ? <ErrorState message={error} retry={() => load()}/> : loading ? <Loading/> : visible.length === 0 ? <Empty title="No products found" detail="Try another product search."/> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><input type="checkbox" aria-label="Select all eligible products" checked={visibleEligible.length > 0 && visibleEligible.every((item) => selected.includes(item.id))} onChange={toggleAll}/></th><th>Product</th><th>Current price</th><th>Current deal</th><th>Stock</th><th>Eligibility / Featured</th></tr></thead><tbody>{visible.map((item) => { const canSelect = (view === 'deals' ? removableDeals : eligible).some((row) => row.id === item.id); const sale = item.price * (1 - item.discount_percent / 100); return <tr key={item.id}><td><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} disabled={!canSelect || saving} onChange={() => toggle(item.id)}/></td><td><div className="admin-product-cell">{item.image_url ? <img src={item.image_url} alt=""/> : <span className="admin-thumb"><Package size={15}/></span>}<span><strong>{item.name}</strong><small>{item.sku ?? 'No SKU'} · {item.category?.name ?? 'Unassigned'}</small></span></div></td><td>{item.discount_percent > 0 ? <><strong>{formatMoney(sale)}</strong><small><s>{formatMoney(item.price)}</s></small></> : formatMoney(item.price)}</td><td>{item.discount_percent > 0 ? <em className={statusClass('approved')}>{item.discount_percent}% OFF</em> : <span className="admin-copy">No deal</span>}</td><td>{item.track_inventory ? item.inventory : 'Not tracked'}</td><td><div className="admin-action-row">{canSelect ? <em className={statusClass('approved')}>{view === 'deals' ? 'Active deal' : 'Eligible'}</em> : <em className={statusClass('pending')}>{item.publication_status !== 'published' ? 'Not published' : item.moderation_status !== 'approved' ? 'Not approved' : item.track_inventory && item.inventory <= 0 ? 'Out of stock' : item.discount_percent > 0 ? 'Already discounted' : 'Not eligible'}</em>}<button type="button" className="admin-button admin-button--outline" disabled={saving} onClick={async()=>{try{await setAdminProductFeatured(item.id,!item.is_featured);setItems((rows)=>rows.map((row)=>row.id===item.id?{...row,is_featured:!row.is_featured}:row));push(item.is_featured?'Removed from Featured Products.':'Added to Featured Products.','success')}catch(cause){push(cause instanceof Error?cause.message:'Featured status could not be updated.','error')}}}>{item.is_featured?'★ Featured':'☆ Mark featured'}</button></div></td></tr> })}</tbody></table></div>}
    </section>
  </section>
}

function Categories() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCategory | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = (quiet = false) => { if (!quiet) setLoading(true); setError(null); void listAdminCategories().then((next) => setItems((current) => mergeRowsById(current, next))).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Categories could not be loaded.')).finally(() => { if (!quiet) setLoading(false) }) }
  useEffect(load, [])
  useAutoRefresh(load)
  useEffect(() => { if (!image) { setImagePreview(null); return } const url = URL.createObjectURL(image); setImagePreview(url); return () => URL.revokeObjectURL(url) }, [image])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      const imageUrl = image ? await uploadPublicMedia(image, 'categories') : editing?.image_url ?? null
      const savedCategory = await saveCategory({ name: String(data.get('name') ?? '').trim(), slug: String(data.get('slug') ?? '').trim(), description: String(data.get('description') ?? ''), is_active: data.get('is_active') === 'on', is_coming_soon: data.get('is_coming_soon') === 'on', is_food_category: data.get('is_food_category') === 'on', sort_order: Number(data.get('sort_order') ?? 0), parent_id: editing?.parent_id ?? null, eyebrow: editing?.eyebrow ?? null, image_url: imageUrl, seo_title: editing?.seo_title ?? null, seo_description: editing?.seo_description ?? null }, editing?.id)
      if (!savedCategory) throw new Error('The category could not be verified after saving.')
      setItems((current) => editing ? current.map((row) => row.id === savedCategory.id ? { ...row, ...savedCategory } : row) : [...current, savedCategory as AdminCategory].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
      push(editing ? 'Category updated.' : 'Category created.')
      setShowForm(false); setEditing(null); setImage(null)
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Category could not be saved.', 'error') }
    finally { setSaving(false) }
  }
  function startEdit(item: AdminCategory) { setEditing(item); setImage(null); setShowForm(true) }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Collections and taxonomy</p><h2>Categories</h2></div><button className="admin-button" onClick={() => { setEditing(null); setImage(null); setShowForm(true) }}><Plus size={16} /> New category</button></div>
    {showForm && <form key={editing?.id ?? 'new-category'} className="admin-form admin-panel" onSubmit={(event) => void submit(event)}><div className="admin-form-grid">
      <label>Name<input name="name" required defaultValue={editing?.name ?? ''} /></label><label>Slug<input name="slug" required defaultValue={editing?.slug ?? ''} /></label><label>Sort order<input name="sort_order" type="number" min="0" defaultValue={editing?.sort_order ?? 0} /></label><label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? false} /> Active / visible on storefront</label><label className="admin-check"><input name="is_coming_soon" type="checkbox" defaultChecked={editing?.is_coming_soon ?? false} /> Coming soon (category is visible but disabled)</label><label className="admin-check"><input name="is_food_category" type="checkbox" defaultChecked={editing?.is_food_category ?? false} /> Food Category (enables food units and daily dishes)</label><label className="admin-form-span"><span>Description</span><textarea name="description" rows={3} defaultValue={editing?.description ?? ''} /></label>
      <label className="admin-form-span"><span>Category image (JPG, PNG, WebP or AVIF; max 8 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && (file.size > 8 * 1024 * 1024 || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))) { push('Choose a JPG, PNG, WebP or AVIF image up to 8 MB.', 'error'); event.target.value = ''; setImage(null); return } setImage(file) }} /></label>
      {(imagePreview || editing?.image_url) && <img src={imagePreview ?? editing?.image_url ?? ''} alt="Category image preview" style={{ maxWidth: 220, maxHeight: 140, objectFit: 'cover', borderRadius: 8 }} />}
    </div><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" onClick={() => { setShowForm(false); setEditing(null); setImage(null) }}>Cancel</button><button className="admin-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save category' : 'Create category'}</button></div></form>}
    {error ? <ErrorState message={error} retry={load} /> : loading ? <Loading /> : items.length === 0 ? <Empty title="No categories yet" detail="Create your first live category, then assign products to it." /> : <div className="admin-table-wrap"><TableTools /><table className="admin-table"><thead><tr><th>Name</th><th>Slug</th><th>Visibility</th><th>Availability</th><th>Order</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.description || 'No description'}</small></td><td>{item.slug}{item.is_food_category && <small>Food Category</small>}</td><td><em className={statusClass(item.is_active ? 'active' : 'hidden')}>{item.is_active ? 'active' : 'inactive / hidden'}</em></td><td><em className={statusClass(item.is_coming_soon ? 'pending' : 'published')}>{item.is_coming_soon ? 'Coming soon' : 'Available'}</em></td><td>{item.sort_order}</td><td>{formatDate(item.updated_at)}</td><td><button type="button" className="admin-small-button" onClick={() => startEdit(item)}><Edit2 size={14} /> Edit</button></td></tr>)}</tbody></table></div>}
  </section>
}

function CustomerReviews() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminCustomerReview[]>([])
  const [filter, setFilter] = useState<'all' | 'product' | 'seller'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void listAdminCustomerReviews()
      .then((next) => setItems((current) => {
        const previous = new Map(current.map((row) => [row.review_id, row]))
        return next.map((row) => { const old = previous.get(row.review_id); return old && JSON.stringify(old) === JSON.stringify(row) ? old : row })
      }))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Customer reviews could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }
  useEffect(() => { load() }, [])
  useAutoRefresh(load)
  async function setStatus(item: AdminCustomerReview, status: 'approved' | 'rejected') {
    if (busyId) return
    setBusyId(item.review_id)
    const previous = item.status
    setItems((current) => current.map((row) => row.review_id === item.review_id ? { ...row, status } : row))
    try {
      await setAdminCustomerReviewStatus(item.review_type, item.review_id, status)
      push(status === 'approved' ? 'Review is visible to customers.' : 'Review hidden from customers.', 'success')
    } catch (cause) {
      setItems((current) => current.map((row) => row.review_id === item.review_id ? { ...row, status: previous } : row))
      push(cause instanceof Error ? cause.message : 'Review status could not be updated.', 'error')
    } finally { setBusyId(null) }
  }
  const visible = filter === 'all' ? items : items.filter((item) => item.review_type === filter)
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Customer feedback moderation</p><h2>Customer Reviews</h2><p className="admin-copy">Review products and shops, then control whether each review is visible on the storefront.</p></div><button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="admin-toolbar"><select aria-label="Filter review type" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All reviews</option><option value="product">Product reviews</option><option value="seller">Shop reviews</option></select><span className="admin-table-count">{visible.length} reviews</span></div>
    {error ? <ErrorState message={error} retry={load}/> : loading ? <Loading/> : visible.length === 0 ? <Empty title="No customer reviews yet" detail="Reviews submitted for products and shops will appear here."/> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Type / target</th><th>Customer</th><th>Rating</th><th>Review</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map((item) => <tr key={item.review_id}><td><strong>{item.review_type === 'product' ? 'Product' : 'Shop'}</strong><small>{item.target_name}</small></td><td>{item.buyer_name}<small>{formatDate(item.created_at)}</small></td><td><strong>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</strong><small>{item.rating}/5</small></td><td>{item.title && <strong>{item.title}</strong>}<small>{item.comment || 'No written comment'}</small></td><td>{item.order_number}</td><td><em className={statusClass(item.status === 'rejected' ? 'hidden' : item.status)}>{item.status === 'rejected' ? 'hidden' : item.status}</em></td><td><div className="admin-action-row">{item.status === 'approved' ? <button type="button" className="admin-small-button admin-small-button--danger" disabled={busyId === item.review_id} onClick={() => void setStatus(item, 'rejected')}><EyeOff size={14}/> Hide</button> : <button type="button" className="admin-small-button" disabled={busyId === item.review_id} onClick={() => void setStatus(item, 'approved')}><Eye size={14}/> Unhide</button>}{busyId === item.review_id && <small>Saving…</small>}</div></td></tr>)}
      </tbody></table></div>}
  </section>
}
function ApiPagination({ page, pageSize, count, onPageChange, loading }: { page: number; pageSize: number; count: number; onPageChange: (page: number) => void; loading: boolean }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const start = count ? page * pageSize + 1 : 0
  const end = Math.min(count, (page + 1) * pageSize)
  return <div className="admin-table-tools__footer"><span className="admin-table-count">{count ? `Showing ${start}–${end} of ${count}` : 'No records'}</span><div className="admin-table-tools__pagination"><span>Page {page + 1} of {pages}</span><button type="button" className="admin-icon-button" aria-label="Previous page" disabled={loading || page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}><ChevronLeft size={15}/></button><button type="button" className="admin-icon-button" aria-label="Next page" disabled={loading || page + 1 >= pages} onClick={() => onPageChange(Math.min(pages - 1, page + 1))}><ChevronRight size={15}/></button></div></div>
}

function TableTools() {
  const [term, setTerm] = useState('')
  const [sortIndex, setSortIndex] = useState('')
  const [descending, setDescending] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const host = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const table = host.current?.parentElement?.querySelector<HTMLTableElement>('table.admin-table')
    const body = table?.tBodies[0]
    if (!body) return
    const applyRows = () => {
    const allRows = Array.from(body.rows)
    let rows = allRows.filter((row) => row.innerText.toLowerCase().includes(term.trim().toLowerCase()))
    if (sortIndex !== '') {
      const index = Number(sortIndex)
      rows = [...rows].sort((a, b) => {
        const left = a.cells[index]?.innerText.trim() ?? ''
        const right = b.cells[index]?.innerText.trim() ?? ''
        const leftNum = Number(left.replace(/[^0-9.-]/g, ''))
        const rightNum = Number(right.replace(/[^0-9.-]/g, ''))
        const result = Number.isFinite(leftNum) && Number.isFinite(rightNum) && left && right ? leftNum - rightNum : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        return descending ? -result : result
      })
    }
    const start = page * pageSize
    const visible = new Set(rows.slice(start, start + pageSize))
    allRows.forEach((row) => { row.style.display = visible.has(row) ? '' : 'none' })
    }
    applyRows()
    const observer = new MutationObserver(applyRows)
    observer.observe(body, { childList: true })
    return () => observer.disconnect()
  }, [term, sortIndex, descending, page, pageSize])
  const table = host.current?.parentElement?.querySelector<HTMLTableElement>('table.admin-table')
  const headings = table?.tHead?.rows[0] ? Array.from(table.tHead.rows[0].cells).map((cell, index) => ({ label: cell.innerText.trim(), index })).filter(({ label }) => label && !['actions', 'next action'].includes(label.toLowerCase())) : []
  const rowCount = table?.tBodies[0]?.rows.length ?? 0
  const filteredCount = table?.tBodies[0] ? Array.from(table.tBodies[0].rows).filter((row) => row.innerText.toLowerCase().includes(term.trim().toLowerCase())).length : rowCount
  const pages = Math.max(1, Math.ceil(filteredCount / pageSize))
  return <div ref={host} className="admin-table-tools">
    <div className="admin-table-tools__main">
      <label className="admin-search admin-table-tools__search"><Search size={16} /><input aria-label="Filter table rows" value={term} onChange={(event) => { setTerm(event.target.value); setPage(0) }} placeholder="Search records in this table" /></label>
      <div className="admin-table-tools__options">
        <label className="admin-table-sort"><span>Sort by</span><select aria-label="Sort table" value={sortIndex} onChange={(event) => { setSortIndex(event.target.value); setPage(0) }}><option value="">Default order</option>{mounted && headings.map(({ label, index }) => <option key={index} value={index}>{label}</option>)}</select></label>
        <label className="admin-table-sort"><span>Direction</span><select aria-label="Sort direction" value={descending ? 'desc' : 'asc'} onChange={(event) => setDescending(event.target.value === 'desc')}><option value="desc">Newest / Z–A</option><option value="asc">Oldest / A–Z</option></select></label>
        <label className="admin-table-sort"><span>Rows</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10 rows</option><option value={12}>12 rows</option></select></label>
      </div>
    </div>
    <div className="admin-table-tools__footer"><span className="admin-table-count">{filteredCount ? `Showing ${page * pageSize + 1}–${Math.min(filteredCount, (page + 1) * pageSize)} of ${filteredCount}` : 'No matching records'}</span><div className="admin-table-tools__pagination"><span>Page {page + 1} of {pages}</span><button type="button" className="admin-icon-button" aria-label="Previous table page" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={15} /></button><button type="button" className="admin-icon-button" aria-label="Next table page" disabled={page + 1 >= pages} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}><ChevronRight size={15} /></button></div></div>
  </div>
}

function Pagination({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="admin-pagination"><span>{total ? `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} of ${total}` : '0 results'}</span><label>Rows <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}><option value={10}>10</option><option value={12}>12</option></select></label><button className="admin-icon-button" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /></button><span>Page {page + 1} / {pages}</span><button className="admin-icon-button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={15} /></button></div>
}

function Orders() {
  const { push } = useToast(); const [items, setItems] = useState<(AdminOrder & { vendor_names: string[]; has_food_items: boolean })[]>([]); const [confirmationTarget, setConfirmationTarget] = useState<(AdminOrder & { vendor_names: string[]; has_food_items: boolean }) | null>(null); const [deliveryDate, setDeliveryDate] = useState(new Date().toLocaleDateString('en-CA')); const [deliveryStart, setDeliveryStart] = useState(''); const [deliveryEnd, setDeliveryEnd] = useState(''); const [deliveryNote, setDeliveryNote] = useState(''); const [confirmationDetails, setConfirmationDetails] = useState<Awaited<ReturnType<typeof getAdminOrderDetail>>[]>([]); const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]); const [readyItemIds, setReadyItemIds] = useState<string[]>([]); const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0); const [existingDeliveryBatchOrderIds, setExistingDeliveryBatchOrderIds] = useState<string[]>([]); const [deliveryFeeOverride, setDeliveryFeeOverride] = useState(''); const [feeAdjustmentReason, setFeeAdjustmentReason] = useState(''); const [confirmationLoading, setConfirmationLoading] = useState(false); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [vendorId, setVendorId] = useState('all'); const [vendors, setVendors] = useState<AdminOrderVendor[]>([]); const [sort, setSort] = useState('created_at.desc'); const [page, setPage] = useState(0); const [pageSize, setPageSize] = useState(12); const [total, setTotal] = useState(0); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [updatingIds, setUpdatingIds] = useState<string[]>([]); const [deliveryCollectionTarget, setDeliveryCollectionTarget] = useState<(AdminOrder & { vendor_names: string[]; has_food_items: boolean }) | null>(null); const [deliveryCollectionItems, setDeliveryCollectionItems] = useState<{ id: string; name: string; quantity: number; amount: string }[]>([]); const [deliveryCollectionUnpaid, setDeliveryCollectionUnpaid] = useState(false); const [deliveryCollectionReason, setDeliveryCollectionReason] = useState('')
  const [driverAssignments, setDriverAssignments] = useState<Record<string, { driver_name: string; driver_phone: string; assignment_status: string; products: { name: string; quantity: number }[] }>>({})
  const [driverAssignmentError, setDriverAssignmentError] = useState<string | null>(null)
  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void (async () => {
      const result = await listAdminOrders(search, status, page, pageSize, sort, vendorId)
      setItems(result.items)
      setTotal(result.count)
      const orderIds = result.items.map((order) => order.id)
      if (!orderIds.length) {
        setDriverAssignments({})
        setDriverAssignmentError(null)
        return
      }
      try {
        const client = getSupabase() as any
        const [assignmentResult, productResult] = await Promise.all([
          client.rpc('admin_list_order_driver_assignments', { p_order_ids: orderIds }),
          client.from('order_items').select('order_id, product_name_snapshot, quantity').in('order_id', orderIds).limit(10000)
        ])
        if (assignmentResult.error) throw new Error(assignmentResult.error.message)
        if (productResult.error) throw new Error(productResult.error.message)
        const productsByOrder = new Map<string, { name: string; quantity: number }[]>()
        for (const item of productResult.data ?? []) {
          const rows = productsByOrder.get(item.order_id) ?? []
          rows.push({ name: item.product_name_snapshot || 'Product', quantity: Number(item.quantity) || 0 })
          productsByOrder.set(item.order_id, rows)
        }
        const nextAssignments: Record<string, { driver_name: string; driver_phone: string; assignment_status: string; products: { name: string; quantity: number }[] }> = {}
        for (const assignment of assignmentResult.data ?? []) {
          if (assignment.assignment_status === 'cancelled') continue
          nextAssignments[assignment.order_id] = {
            driver_name: assignment.driver_name || 'Driver',
            driver_phone: assignment.driver_phone || '',
            assignment_status: assignment.assignment_status,
            products: productsByOrder.get(assignment.order_id) ?? []
          }
        }
        setDriverAssignments(nextAssignments)
        setDriverAssignmentError(null)
      } catch (cause) {
        setDriverAssignments({})
        setDriverAssignmentError(cause instanceof Error ? cause.message : 'Rider assignments could not be loaded.')
      }
    })().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.')).finally(() => { if (!quiet) setLoading(false) })
  }
  useEffect(load, [search, status, vendorId, sort, page, pageSize]); useAutoRefresh(load)
  useEffect(() => { void listAdminOrderVendors().then(setVendors).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Vendors could not be loaded.')) }, [])
  async function openOrderConfirmation(order: AdminOrder & { vendor_names: string[]; has_food_items: boolean }) {
    setConfirmationTarget(order)
    setConfirmationLoading(true)
    setConfirmationDetails([])
    setExistingDeliveryBatchOrderIds([])
    setSelectedOrderIds([order.id])
    setReadyItemIds([])
    setDeliveryNote('')
    setFeeAdjustmentReason('')
    setDeliveryFeeOverride('')
    const date = new Date()
    if (!order.has_food_items) date.setDate(date.getDate() + 7)
    setDeliveryDate(date.toLocaleDateString('en-CA'))
    setDeliveryStart('09:00')
    setDeliveryEnd('21:00')
    try {
      const [related, settings] = await Promise.all([findCustomerDeliveryOrders(order.id), getAdminStoreSettings()])
      setDefaultDeliveryFee(settings.free_delivery_enabled ? 0 : Number(settings.delivery_fee))
      const rows = [order, ...related]
      const [details, batchRows] = await Promise.all([Promise.all(rows.map((row) => getAdminOrderDetail(row.id))), Promise.all(related.map((row) => listOrderDeliveryBatches(row.id)))])
      setExistingDeliveryBatchOrderIds(related.filter((_, index) => batchRows[index].some((batch: any) => batch.status === 'scheduled')).map((row) => row.id))
      setConfirmationDetails(details)
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Customer orders could not be loaded for delivery confirmation.', 'error')
      setConfirmationTarget(null)
    } finally { setConfirmationLoading(false) }
  }
  async function confirmSelectedOrders() {
    if (!confirmationTarget || confirmationLoading) return
    if (!selectedOrderIds.includes(confirmationTarget.id)) { push('The order being confirmed must remain selected.', 'error'); return }
    const selectedDetails = confirmationDetails.filter((detail) => selectedOrderIds.includes(detail.order.id))
    const selectedHasFoodItems = selectedDetails.some((detail) => detail.items.some((item: any) => /food|grocery/i.test(item.product_category_name ?? '') || Boolean(item.food_product_type)))
    if (selectedHasFoodItems && (!deliveryDate || !deliveryStart || !deliveryEnd || deliveryEnd <= deliveryStart)) { push('Food orders require a valid delivery date and time window.', 'error'); return }
    const selectedItems = selectedDetails.flatMap((detail) => detail.items.map((item) => item.id))
    if (readyItemIds.some((id) => !selectedItems.includes(id))) { push('Ready products must belong to the selected orders.', 'error'); return }
    const override = deliveryFeeOverride.trim() === '' ? null : Number(deliveryFeeOverride)
    if (override !== null && (!Number.isFinite(override) || override < 0)) { push('Enter a valid delivery fee of zero or more.', 'error'); return }
    if (override !== null && override !== defaultDeliveryFee && !feeAdjustmentReason.trim()) { push('Add a reason when changing or waiving the standard delivery fee.', 'error'); return }
    setConfirmationLoading(true)
    setUpdatingIds((current) => [...new Set([...current, ...selectedOrderIds])])
    try {
      const result = await confirmOrdersWithDeliveryBatch({
        order_ids: [confirmationTarget.id, ...selectedOrderIds.filter((id) => id !== confirmationTarget.id)],
        email_order_ids: confirmationDetails.filter((detail) => selectedOrderIds.includes(detail.order.id) && detail.order.order_status === 'pending').map((detail) => detail.order.id),
        ready_item_ids: readyItemIds,
        expected_delivery_date: selectedHasFoodItems ? deliveryDate : null,
        delivery_window_start: selectedHasFoodItems ? deliveryStart : null,
        delivery_window_end: selectedHasFoodItems ? deliveryEnd : null,
        delivery_note: deliveryNote,
        delivery_fee_override: override,
        fee_adjustment_reason: feeAdjustmentReason.trim() || null,
      })
      setItems((current) => current.map((row) => selectedOrderIds.includes(row.id) && row.order_status === 'pending' ? { ...row, order_status: 'confirmed' } : row))
      setConfirmationTarget(null)
      setConfirmationDetails([])
      push(result.emailSent ? `Delivery batch ${result.batchId.slice(0, 8)} created. Selected orders remain separate; customer emails sent.` : `Delivery batch ${result.batchId.slice(0, 8)} created. Some customer emails could not be sent.`, result.emailSent ? 'success' : 'error')
      load(true)
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Orders could not be confirmed into a delivery batch.', 'error')
    } finally {
      setConfirmationLoading(false)
      setUpdatingIds((current) => current.filter((id) => !selectedOrderIds.includes(id)))
    }
  }
  function toggleConfirmationOrder(orderId: string, checked: boolean) {
    setSelectedOrderIds((current) => checked ? [...new Set([...current, orderId])] : current.filter((id) => id !== orderId && id !== confirmationTarget?.id))
    if (checked && existingDeliveryBatchOrderIds.includes(orderId)) setDeliveryFeeOverride('')
    if (!checked) {
      const detail = confirmationDetails.find((row) => row.order.id === orderId)
      const ids = new Set(detail?.items.map((item) => item.id) ?? [])
      setReadyItemIds((current) => current.filter((id) => !ids.has(id)))
    }
  }
  function toggleReadyItem(itemId: string, checked: boolean) {
    setReadyItemIds((current) => checked ? [...new Set([...current, itemId])] : current.filter((id) => id !== itemId))
  }
  async function changeStatus(order: AdminOrder & { vendor_names: string[]; has_food_items: boolean }, next: Database['public']['Tables']['orders']['Row']['order_status'], deliveryTiming?: { expected_delivery_date: string; delivery_window_start?: string | null; delivery_window_end?: string | null; delivery_note?: string | null }) {
    if (next === order.order_status || updatingIds.includes(order.id)) return
    if (next === 'delivered') {
      try {
        const detail = await getAdminOrderDetail(order.id)
        if (detail.items.some((item) => item.delivery_status !== 'delivered')) { push('Mark every product delivery batch as delivered before closing this order.', 'error'); return }
        setDeliveryCollectionItems(detail.items.map((item) => ({ id: item.id, name: item.product_name_snapshot, quantity: Number(item.quantity), amount: String(Number(item.line_total ?? Number(item.unit_price) * Number(item.quantity))) })))
        setDeliveryCollectionUnpaid(false); setDeliveryCollectionReason(''); setDeliveryCollectionTarget(order)
      } catch (cause) { push(cause instanceof Error ? cause.message : 'Order items could not be loaded.', 'error') }
      return
    }
    if (next === 'confirmed' && !deliveryTiming) {
      await openOrderConfirmation(order)
      return
    }
    if (next === 'cancelled' && !window.confirm(`Cancel order ${order.order_number}?`)) return
    const previousStatus = order.order_status
    setUpdatingIds((current) => [...current, order.id])
    setItems((current) => current.map((item) => item.id === order.id ? { ...item, order_status: next } : item))
    try {
      const emailSent = await updateOrder(order.id, next, deliveryTiming)
      const messages: Record<string, string> = { confirmed: 'Order confirmed after customer verification.', processing: 'Order is being prepared.', shipped: 'Order has been shipped.', delivered: 'Order marked as delivered.', cancelled: 'Order cancelled.' }
      if (emailSent) push(messages[next] ?? 'Order status updated.', 'success')
      else push('Order status updated, but customer email was not sent. Check SMTP secrets and Edge Function logs.', 'error')
    } catch (cause) {
      setItems((current) => current.map((item) => item.id === order.id ? { ...item, order_status: previousStatus } : item))
      push(cause instanceof Error ? cause.message : 'The database rejected this transition.', 'error')
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== order.id))
    }
  }
  async function confirmDeliveryCollection() {
    if (!deliveryCollectionTarget || updatingIds.includes(deliveryCollectionTarget.id)) return
    const amounts = deliveryCollectionItems.map((item) => ({ id: item.id, amount: Number(item.amount) }))
    if (amounts.some((item) => !Number.isFinite(item.amount) || item.amount < 0)) { push('Enter a valid amount for every product.', 'error'); return }
    const order = deliveryCollectionTarget
    const collected = amounts.reduce((sum, item) => sum + item.amount, 0)
    const orderTotal = Number(order.total)
    const isPartialCollection = collected < orderTotal - 0.01
    if (collected > orderTotal + 0.01) { push(`Collected amount cannot exceed order total PKR ${orderTotal.toLocaleString('en-PK')}.`, 'error'); return }
    if (isPartialCollection && !deliveryCollectionUnpaid) { push('Tick “Allow unpaid balance” to deliver this order with an outstanding amount.', 'error'); return }
    if (isPartialCollection && !deliveryCollectionReason.trim()) { push('A reason is required when the collected amount is less than the order total.', 'error'); return }
    setUpdatingIds((current) => [...current, order.id])
    try {
      await saveDeliveryCollection(order.id, amounts)
      if (isPartialCollection) await addOrderNote(order.id, `Partial cash collection: PKR ${collected.toLocaleString('en-PK')} received out of PKR ${orderTotal.toLocaleString('en-PK')}. Outstanding: PKR ${(orderTotal - collected).toLocaleString('en-PK')}. Reason: ${deliveryCollectionReason.trim()}`)
      const paymentStatus = isPartialCollection ? 'pending' : 'paid'
      const emailSent = await updateOrder(order.id, 'delivered', undefined, paymentStatus)
      setItems((current: (AdminOrder & { vendor_names: string[]; has_food_items: boolean })[]) => current.map((row) => row.id === order.id ? { ...row, order_status: 'delivered', payment_status: paymentStatus } : row))
      setDeliveryCollectionTarget(null)
      push(emailSent ? (isPartialCollection ? 'Delivery recorded. Partial collection saved and remaining balance is marked unpaid.' : 'Delivery recorded. Product-wise cash collection saved and order marked paid.') : 'Delivery and collection saved, but customer email could not be sent.', emailSent ? 'success' : 'error')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Delivery collection could not be saved.', 'error') }
    finally { setUpdatingIds((current) => current.filter((id) => id !== order.id)) }
  }
  async function rejectPendingOrder(order: AdminOrder & { vendor_names: string[]; has_food_items: boolean }) {
    if (order.order_status !== 'pending' || updatingIds.includes(order.id)) return
    if (!window.confirm(`Reject order ${order.order_number}? The customer will receive an email update.`)) return
    setUpdatingIds((current) => [...current, order.id])
    const previousStatus = order.order_status
    setItems((current) => status === 'pending' ? current.filter((item) => item.id !== order.id) : current.map((item) => item.id === order.id ? { ...item, order_status: 'cancelled' } : item))
    if (status === 'pending') setTotal((current) => Math.max(0, current - 1))
    try {
      await rejectAdminOrder(order.id)
      push('Order rejected. Customer email notification requested.', 'success')
    } catch (cause) {
      setItems((current) => mergeRowsById(current, [{ ...order, order_status: previousStatus }]))
      if (status === 'pending') setTotal((current) => current + 1)
      push(cause instanceof Error ? cause.message : 'Order could not be rejected.', 'error')
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== order.id))
    }
  }
  const deliveryCollectionTotal = deliveryCollectionItems.reduce((sum,item)=>sum+(Number(item.amount)||0),0)
  const deliveryCollectionPartial = !!deliveryCollectionTarget && deliveryCollectionTotal < Number(deliveryCollectionTarget.total) - 0.01
  return <section className="admin-content"><div className="admin-page-heading"><div><p className="admin-kicker">Fulfilment workflow</p><h2>Orders</h2><p className="admin-copy">Search and filter orders; open any order for full details or a printable slip.</p></div></div><div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search order or customer" /></label><select aria-label="Filter orders by vendor" value={vendorId} onChange={(event) => { setVendorId(event.target.value); setPage(0) }}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shop_name}</option>)}</select><select aria-label="Filter order status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}><option value="all">All statuses</option>{['pending','confirmed','processing','shipped','delivered','cancelled'].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Sort orders" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0) }}><option value="created_at.desc">Newest first</option><option value="created_at.asc">Oldest first</option><option value="total.desc">Highest total</option><option value="total.asc">Lowest total</option></select><button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15} /> Refresh</button></div>{error ? <ErrorState message={error} retry={load} /> : loading ? <Loading /> : items.length === 0 ? <Empty title="No orders found" detail="Try a different search or status filter." /> : <>{driverAssignmentError && <p className="admin-copy">Rider assignment details could not be loaded: {driverAssignmentError}</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Vendor</th><th>Rider / assigned products</th><th>Total</th><th>Payment</th><th>Status</th><th>Update status</th></tr></thead><tbody>{items.map((order, index) => <tr key={order.id}><td>{page * pageSize + index + 1}</td><td><Link className="admin-link-button" to={`/admin/orders/${order.id}`}><strong>{order.order_number}</strong><small>{formatDate(order.created_at)}</small></Link></td><td>{order.customer_name}<small>{order.customer_phone}</small></td><td>{order.vendor_names.length ? order.vendor_names.join(', ') : 'No vendor'}</td><td>{driverAssignments[order.id] ? <><strong>{driverAssignments[order.id].driver_name}</strong>{driverAssignments[order.id].driver_phone && <small>{driverAssignments[order.id].driver_phone}</small>}<small>{driverAssignments[order.id].products.map((product) => product.name + ' × ' + product.quantity).join(', ') || 'Order products'}</small><em className={statusClass(driverAssignments[order.id].assignment_status)}>{driverAssignments[order.id].assignment_status.replace(/_/g, ' ')}</em></> : <span>Not Assigned</span>}</td><td>{formatMoney(order.total)}</td><td><em className={statusClass(order.payment_status)}>{order.payment_status}</em></td><td><em className={statusClass(order.order_status)}>{order.order_status}</em></td><td><select aria-label={`Update status for ${order.order_number}`} className="admin-order-status-select" value={order.order_status} disabled={updatingIds.includes(order.id) || order.order_status === 'cancelled' || order.order_status === 'delivered'} onChange={(event) => void changeStatus(order, event.target.value as Database['public']['Tables']['orders']['Row']['order_status'])}>{(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const).filter((value) => value === order.order_status || (value === 'cancelled' ? !['delivered', 'cancelled'].includes(order.order_status) : ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].indexOf(value) > ['pending', 'confirmed', 'processing', 'shipped', 'delivered'].indexOf(order.order_status))).map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select>{order.order_status === 'pending' && <button type="button" className="admin-small-button admin-small-button--danger" disabled={updatingIds.includes(order.id)} onClick={() => void rejectPendingOrder(order)}>Reject</button>}{updatingIds.includes(order.id) && <small>Saving…</small>}</td></tr>)}</tbody></table></div><Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(size) => { setPage(0); setPageSize(size) }} /></>}<VendorPickupQueue />{deliveryCollectionTarget && <div className="admin-modal-backdrop food-timing-backdrop" role="presentation"><section className="admin-modal food-timing-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-collection-title"><div className="food-timing-top"><div className="food-timing-icon"><Package size={23}/></div><button type="button" className="admin-icon-button" aria-label="Close delivery collection" onClick={() => setDeliveryCollectionTarget(null)}><X size={18}/></button></div><p className="admin-kicker">CASH COLLECTION · DELIVERY CHECK</p><h3 id="delivery-collection-title">Confirm amount received</h3><p className="food-timing-description">Enter the actual cash received from customer for each product in order <strong>{deliveryCollectionTarget.order_number}</strong>. Order will be marked delivered only when the total matches.</p><div className="food-timing-fields">{deliveryCollectionItems.map((item,index)=><label className="food-timing-field" key={item.id}><span>{item.name} · Qty {item.quantity}</span><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => setDeliveryCollectionItems((rows) => rows.map((row,i) => i === index ? { ...row, amount: event.target.value } : row))} /></label>)}<div className="food-timing-hint"><span>Order total: PKR {Number(deliveryCollectionTarget.total).toLocaleString('en-PK')} · Entered: PKR {deliveryCollectionTotal.toLocaleString('en-PK')} · Remaining: PKR {Math.max(0, Number(deliveryCollectionTarget.total)-deliveryCollectionTotal).toLocaleString('en-PK')}</span></div><label className="food-timing-unpaid-option"><input type="checkbox" checked={deliveryCollectionUnpaid} onChange={(event) => setDeliveryCollectionUnpaid(event.target.checked)} /><span><strong>Allow unpaid balance</strong><small>Order can be delivered while some cash remains outstanding.</small></span></label>{deliveryCollectionPartial && <label className="food-timing-field"><span>Reason for partial / unpaid collection <strong>*</strong></span><textarea required rows={3} value={deliveryCollectionReason} onChange={(event) => setDeliveryCollectionReason(event.target.value)} placeholder="Explain why the full order amount was not collected" /></label>}</div><div className="food-timing-actions"><button type="button" className="admin-button admin-button--outline" onClick={() => setDeliveryCollectionTarget(null)}>Cancel</button><button type="button" className="admin-button food-timing-submit" disabled={updatingIds.includes(deliveryCollectionTarget.id) || deliveryCollectionItems.some((item) => item.amount.trim() === '') || deliveryCollectionTotal > Number(deliveryCollectionTarget.total) + 0.01 || (deliveryCollectionPartial && (!deliveryCollectionUnpaid || !deliveryCollectionReason.trim()))} onClick={() => void confirmDeliveryCollection()}>{updatingIds.includes(deliveryCollectionTarget.id) ? 'Saving…' : 'Save collection & mark delivered'}</button></div></section></div>}{confirmationTarget && <div className="admin-modal-backdrop food-timing-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirmationLoading) setConfirmationTarget(null) }}><section className="admin-modal food-timing-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-confirm-title"><div className="food-timing-top"><div className="food-timing-icon"><Package size={23}/></div><button type="button" className="admin-icon-button" aria-label="Close delivery confirmation" disabled={confirmationLoading} onClick={() => setConfirmationTarget(null)}><X size={18}/></button></div><p className="admin-kicker">ORDER CONFIRMATION · DELIVERY PLAN</p><h3 id="delivery-confirm-title">Confirm and plan delivery</h3><p className="food-timing-description">Order <strong>{confirmationTarget.order_number}</strong>. Select any other orders belonging to this customer that you want to send in the same delivery. Orders will keep their own order numbers and accounts.</p>
      {confirmationLoading && <Loading/>}
      {!confirmationLoading && <><div className="admin-panel" style={{ marginBottom: 14 }}><strong>Other active orders from this customer</strong>{confirmationDetails.filter((detail) => detail.order.id !== confirmationTarget.id).length === 0 ? <p className="admin-copy">No other eligible orders were found.</p> : confirmationDetails.filter((detail) => detail.order.id !== confirmationTarget.id).map((detail) => <label key={detail.order.id} className="admin-check" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}><input type="checkbox" checked={selectedOrderIds.includes(detail.order.id)} onChange={(event) => toggleConfirmationOrder(detail.order.id,event.target.checked)}/><span><strong>{detail.order.order_number}</strong> · {formatMoney(detail.order.total)}<small>{detail.order.order_status} · {formatDate(detail.order.created_at)}</small></span></label>)}</div>
      <div className="admin-panel" style={{ marginBottom: 14 }}><strong>Products ready for the first delivery</strong><p className="admin-copy">Tick only the products that are ready now. Unticked products remain pending and can be scheduled in a later delivery without charging the customer another delivery fee (based on the additional-delivery setting).</p>{confirmationDetails.filter((detail) => selectedOrderIds.includes(detail.order.id)).flatMap((detail) => detail.items.map((item) => ({ ...item, orderNumber: detail.order.order_number }))).map((item) => <label key={item.id} className="admin-check" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}><input type="checkbox" checked={readyItemIds.includes(item.id)} disabled={item.delivery_status !== 'pending'} onChange={(event) => toggleReadyItem(item.id,event.target.checked)}/><span>{item.product_name_snapshot}<small>{item.orderNumber} · Qty {item.quantity} · {formatMoney(item.line_total)} · {item.delivery_status}</small></span></label>)}</div>
      {confirmationDetails.filter((detail) => selectedOrderIds.includes(detail.order.id)).some((detail) => detail.items.some((item: any) => /food|grocery/i.test(item.product_category_name ?? '') || Boolean(item.food_product_type))) && (<div className="food-timing-fields"><label className="food-timing-field food-timing-field--date"><span>Delivery date</span><input type="date" required min={new Date().toLocaleDateString('en-CA')} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)}/></label><div className="food-timing-field"><span>Delivery window</span><div className="food-timing-time-range"><label><small>From</small><input aria-label="Delivery time from" type="time" required value={deliveryStart} onChange={(event) => setDeliveryStart(event.target.value)}/></label><span className="food-timing-to">to</span><label><small>Until</small><input aria-label="Delivery time until" type="time" required min={deliveryStart || undefined} value={deliveryEnd} onChange={(event) => setDeliveryEnd(event.target.value)}/></label></div></div></div>)}<label className="food-timing-field food-timing-field--note"><span>Delivery note <em>Optional</em></span><input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Optional customer delivery note"/></label>
      <label className="food-timing-field"><span>Delivery fee (PKR) · Standard {formatMoney(defaultDeliveryFee)}</span><input type="number" min="0" step="0.01" disabled={selectedOrderIds.some((id) => existingDeliveryBatchOrderIds.includes(id))} value={deliveryFeeOverride} onChange={(event) => setDeliveryFeeOverride(event.target.value)} placeholder={String(defaultDeliveryFee)}/><small>{selectedOrderIds.some((id) => existingDeliveryBatchOrderIds.includes(id)) ? 'An active delivery batch already has its delivery fee. Newly linked orders will not add a second fee.' : 'Leave blank to use the configured standard fee. Enter 0 to waive it.'}</small></label><label className="food-timing-field food-timing-field--note"><span>Fee adjustment reason</span><input value={feeAdjustmentReason} onChange={(event) => setFeeAdjustmentReason(event.target.value)} placeholder="Required only when changing the standard fee"/></label>
      <div className="food-timing-hint"><span className="food-timing-hint__dot"/><span>Only one delivery fee is charged for this delivery batch. Orders remain separate and retain their own accounting records.</span></div></>}
      <div className="food-timing-actions"><button type="button" className="admin-button admin-button--outline" disabled={confirmationLoading} onClick={() => setConfirmationTarget(null)}>Cancel</button><button type="button" className="admin-button food-timing-submit" disabled={confirmationLoading || (confirmationDetails.filter((detail) => selectedOrderIds.includes(detail.order.id)).some((detail) => detail.items.some((item: any) => /food|grocery/i.test(item.product_category_name ?? '') || Boolean(item.food_product_type))) && (!deliveryDate || !deliveryStart || !deliveryEnd || deliveryEnd <= deliveryStart))} onClick={() => void confirmSelectedOrders()}>{confirmationLoading ? 'Saving…' : `Confirm ${selectedOrderIds.length} order(s) & create delivery`}</button></div></section></div>}</section>
}


function VendorPickupQueue() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { push } = useToast()
  async function load() {
    setLoading(true); setError(null)
    try { setRows(await listAdminVendorPickups()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Pickup queue could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function markCollected(id: string) {
    setBusy(id)
    try { await markAdminVendorPickedUp(id); push('Vendor pickup marked as collected.', 'success'); await load() }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Pickup could not be updated.', 'error') }
    finally { setBusy(null) }
  }
  return <section className="admin-panel" style={{ marginTop: 24 }}>
    <div className="admin-panel-heading"><div><p className="admin-kicker">Vendor collection</p><h3>Pickup queue</h3><p className="admin-copy">Customer details are visible to admins only. Vendors receive product-only slips.</p></div><button className="admin-button admin-button--outline" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button></div>
    {error && <p className="admin-error">{error}</p>}
    {loading ? <Loading /> : rows.length === 0 ? <p className="admin-copy">No vendor pickups have been created yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order / Vendor</th><th>Customer & delivery</th><th>Items</th><th>Pickup status</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.pickup_id}><td><strong>{row.order_number}</strong><small>{row.shop_name}</small></td><td>{row.customer_name}<small>{row.customer_phone}</small><small>{typeof row.shipping_address === 'object' && row.shipping_address ? Object.values(row.shipping_address).filter(Boolean).join(', ') : ''}</small>{row.delivery_lat != null && row.delivery_lng != null && <a href={'https://www.google.com/maps?q=' + row.delivery_lat + ',' + row.delivery_lng} target="_blank" rel="noreferrer">Delivery pin</a>}</td><td>{(Array.isArray(row.items) ? row.items : []).map((item: any, index: number) => <div key={index}><strong>{item.product_name}</strong><small>{item.sku || 'No SKU'} · Qty {item.quantity}</small></div>)}</td><td><em className={statusClass(row.pickup_status)}>{row.pickup_status.replace(/_/g, ' ')}</em></td><td>{row.pickup_status === 'ready_for_pickup' ? <button className="admin-small-button" disabled={busy === row.pickup_id} onClick={() => void markCollected(row.pickup_id)}>{busy === row.pickup_id ? 'Saving…' : 'Mark collected'}</button> : row.pickup_status === 'picked_up' ? 'Collected' : 'Waiting for vendor'}</td></tr>)}</tbody></table></div>}
  </section>
}

function formatVariantSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return ''
  const data = snapshot as Record<string, unknown>
  const parts: string[] = []
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  const value = data.value
  if (value !== null && value !== undefined && String(value).trim()) {
    parts.push(label ? `${label}: ${String(value).trim()}` : String(value).trim())
  }
  const attributes = data.attributes
  if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
    for (const [key, raw] of Object.entries(attributes as Record<string, unknown>)) {
      if (raw === null || raw === undefined || typeof raw === 'object' || !String(raw).trim()) continue
      const prettyKey = key.replace(/[_-]+/g, ' ').replace(/\\b\\w/g, (char) => char.toUpperCase())
      const prettyValue = typeof raw === 'string' ? raw.trim().replace(/\\b\\w/g, (char) => char.toUpperCase()) : String(raw)
      parts.push(`${prettyKey}: ${prettyValue}`)
    }
  }
  // Also support older snapshots that contain plain option key/value pairs.
  if (!parts.length) {
    for (const [key, raw] of Object.entries(data)) {
      if (['label', 'value', 'attributes'].includes(key) || raw === null || raw === undefined || typeof raw === 'object' || !String(raw).trim()) continue
      const prettyKey = key.replace(/[_-]+/g, ' ').replace(/\\b\\w/g, (char) => char.toUpperCase())
      parts.push(`${prettyKey}: ${String(raw).trim()}`)
    }
  }
  return parts.join(' · ')
}

function OrderDetailPage({ orderId }: { orderId: string }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminOrderDetail>> | null>(null); const [deliveries, setDeliveries] = useState<any[]>([]); const [selectedFollowupItemIds, setSelectedFollowupItemIds] = useState<string[]>([]); const [followupDate, setFollowupDate] = useState(new Date(Date.now() + 86400000).toLocaleDateString('en-CA')); const [followupStart, setFollowupStart] = useState('09:00'); const [followupEnd, setFollowupEnd] = useState('21:00'); const [followupNote, setFollowupNote] = useState(''); const [followupSaving, setFollowupSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [nextDetail, nextDeliveries] = await Promise.all([getAdminOrderDetail(orderId), listOrderDeliveryBatches(orderId)])
      setDetail(nextDetail); setDeliveries(nextDeliveries)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Order details could not be loaded.') }
    finally { setLoading(false) }
  }
  async function scheduleFollowupDelivery() {
    if (!detail || !selectedFollowupItemIds.length) return
    const selectedItemsContainFood = detail.items.some((item: any) => selectedFollowupItemIds.includes(item.id) && (/food|grocery/i.test(item.product_category_name ?? '') || Boolean(item.food_product_type)))
    if (selectedItemsContainFood && (!followupDate || !followupStart || !followupEnd || followupEnd <= followupStart)) { setError('Food products require a valid delivery date and time window.'); return }
    setFollowupSaving(true); setError(null)
    try {
      await createFollowupDeliveryBatch({ order_id: orderId, item_ids: selectedFollowupItemIds, expected_delivery_date: selectedItemsContainFood ? followupDate : null, delivery_window_start: selectedItemsContainFood ? followupStart : null, delivery_window_end: selectedItemsContainFood ? followupEnd : null, delivery_note: followupNote })
      setSelectedFollowupItemIds([])
      setFollowupNote('')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Follow-up delivery could not be scheduled.') }
    finally { setFollowupSaving(false) }
  }
  async function completeDeliveryBatch(batchId: string) {
    setFollowupSaving(true); setError(null)
    try { await markDeliveryBatchDelivered(batchId); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Delivery batch could not be marked delivered.') }
    finally { setFollowupSaving(false) }
  }
  useEffect(() => { void load() }, [orderId])
  if (loading) return <div className="admin-content"><Loading /></div>
  if (error || !detail) return <div className="admin-content"><ErrorState message={error ?? 'Order not found.'} retry={load} /></div>
  const { order, items } = detail
  const alreadyScheduledItemIds = new Set<string>(deliveries.flatMap((batch: any) => (batch.delivery_batch_items ?? []).map((item: any) => String(item.order_item_id))))
  const pendingDeliveryItems = items.filter((item: any) => item.delivery_status !== 'delivered' && !alreadyScheduledItemIds.has(item.id))
  const shipping = order.shipping_address_snapshot && typeof order.shipping_address_snapshot === 'object' && !Array.isArray(order.shipping_address_snapshot) ? order.shipping_address_snapshot as Record<string, unknown> : {}
  const address = ['address_line_1', 'address_line_2', 'area', 'city', 'province', 'postal_code', 'country'].map((key) => shipping[key]).filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(', ') || '—'
  const groupedItems = Array.from(items.reduce((groups, item) => {
    const key = item.product_id ?? item.product_name_snapshot
    const group = groups.get(key) ?? { productName: item.product_name_snapshot, rows: [] as typeof items }
    group.rows.push(item)
    groups.set(key, group)
    return groups
  }, new Map<string, { productName: string; rows: typeof items }>()).values())
  return <section className="admin-content">
    <div className="admin-page-heading no-print"><div><p className="admin-kicker">Order management</p><h2>{order.order_number}</h2></div><div className="admin-action-row"><Link className="admin-button admin-button--outline" to="/admin/orders"><ArrowLeft size={15} /> All orders</Link><button className="admin-button" onClick={() => window.print()}><Printer size={15} /> Print order slip</button></div></div>
    <div className="admin-grid-2 no-print"><div className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">Buyer & delivery</p><h3>{order.customer_name}</h3></div><em className={statusClass(order.order_status)}>{order.order_status}</em></div><p>{order.customer_email ?? 'No email'} · {order.customer_phone}</p><p className="admin-copy">{address}</p>{order.delivery_location_name && <div className="admin-callout"><MapPin size={15} /> Customer-selected map pin: <strong>{order.delivery_location_name}</strong></div>}{order.delivery_lat !== null && order.delivery_lng !== null && <small className="admin-copy">GPS coordinates: {Number(order.delivery_lat).toFixed(6)}, {Number(order.delivery_lng).toFixed(6)}{order.delivery_location_captured_at ? ` · Captured ${formatDate(order.delivery_location_captured_at)}` : ''}</small>}{order.delivery_lat !== null && order.delivery_lng !== null ? <><a className="admin-button admin-button--outline" href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`} target="_blank" rel="noreferrer">Open exact delivery pin in Maps</a><iframe title="Customer delivery location map" className="admin-order-location-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}&z=15&output=embed`} /></> : address !== '—' ? <><a className="admin-button admin-button--outline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Find delivery address on Maps</a><iframe title="Customer delivery address map" className="admin-order-location-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=14&output=embed`} /></> : <p className="admin-copy">No saved delivery coordinates or address were captured for this order.</p>}{order.expected_delivery_date && <div className="admin-callout"><span><strong>Expected delivery:</strong> {String(order.expected_delivery_date)}{order.delivery_window_start && order.delivery_window_end ? ` · ${String(order.delivery_window_start).slice(0,5)}–${String(order.delivery_window_end).slice(0,5)}` : ''}{order.delivery_note ? ` · ${order.delivery_note}` : ''}</span></div>}{order.customer_note && <p className="admin-callout">{order.customer_note}</p>}</div><div className="admin-panel"><p className="admin-kicker">Payment & totals</p><h3>{formatMoney(order.total)}</h3><p>{order.payment_method.toUpperCase()} · {order.payment_status}</p><p className="admin-copy">Subtotal {formatMoney(order.subtotal)} · Delivery {formatMoney(order.delivery_fee)} · Discount {formatMoney(order.discount_amount)}</p><small>Placed {formatDate(order.created_at)} · Updated {formatDate(order.updated_at)}</small></div></div>
    <section className="admin-panel no-print" style={{ marginBottom: 22 }}><div className="admin-panel-heading"><div><p className="admin-kicker">Delivery operations</p><h3>Delivery batches & pending products</h3><p className="admin-copy">This order remains separate in accounting. Each delivery batch tracks only the products assigned to that trip.</p></div></div>
      {deliveries.length === 0 ? <p className="admin-copy">No delivery batch has been created for this order yet.</p> : deliveries.map((batch: any) => <div key={batch.batch_id} className="admin-callout" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><span><strong>{batch.batch_number}</strong> · {batch.status} · Fee {formatMoney(batch.delivery_fee)}<small>{batch.expected_delivery_date ?? 'No date'}{batch.delivery_window_start && batch.delivery_window_end ? ` · ${String(batch.delivery_window_start).slice(0,5)}–${String(batch.delivery_window_end).slice(0,5)}` : ''} · {batch.delivery_batch_items?.length ?? 0} item(s)</small></span>{batch.status !== 'delivered' && batch.status !== 'cancelled' && <button type="button" className="admin-small-button" disabled={followupSaving || !(batch.delivery_batch_items?.length)} onClick={() => void completeDeliveryBatch(batch.batch_id)}>Mark items delivered</button>}</div>)}
      {pendingDeliveryItems.length > 0 && <><h4>Products still waiting for delivery</h4><p className="admin-copy">Select products that are now ready. The configured additional delivery fee applies; it is zero by default.</p>{pendingDeliveryItems.map((item: any) => <label key={item.id} className="admin-check" style={{ display: 'flex', gap: 10, padding: '8px 0' }}><input type="checkbox" checked={selectedFollowupItemIds.includes(item.id)} onChange={(event) => setSelectedFollowupItemIds((current) => event.target.checked ? [...current,item.id] : current.filter((id) => id !== item.id))}/><span>{item.product_name_snapshot}<small>Qty {item.quantity} · {formatMoney(item.line_total)} · {item.delivery_status}</small></span></label>)}{items.some((item: any) => selectedFollowupItemIds.includes(item.id) && (/food|grocery/i.test(item.product_category_name ?? '') || Boolean(item.food_product_type))) && (<div className="food-timing-fields" style={{ marginTop: 12 }}><label className="food-timing-field food-timing-field--date"><span>Follow-up delivery date</span><input type="date" min={new Date().toLocaleDateString('en-CA')} value={followupDate} onChange={(event) => setFollowupDate(event.target.value)}/></label><div className="food-timing-field"><span>Delivery window</span><div className="food-timing-time-range"><label><small>From</small><input type="time" value={followupStart} onChange={(event) => setFollowupStart(event.target.value)}/></label><span className="food-timing-to">to</span><label><small>Until</small><input type="time" min={followupStart} value={followupEnd} onChange={(event) => setFollowupEnd(event.target.value)}/></label></div></div></div>)}<label className="food-timing-field food-timing-field--note"><span>Delivery note</span><input value={followupNote} onChange={(event) => setFollowupNote(event.target.value)} placeholder="Optional note"/></label><div className="admin-form-actions"><button type="button" className="admin-button" disabled={followupSaving || !selectedFollowupItemIds.length} onClick={() => void scheduleFollowupDelivery()}>{followupSaving ? 'Saving…' : 'Schedule separate delivery'}</button></div></>}
      {pendingDeliveryItems.length === 0 && <p className="admin-copy">All products in this order have been assigned to a delivery batch or delivered.</p>}
    </section>
    <article className="admin-order-slip">
      <header className="slip-brand"><div className="slip-brand__identity"><img className="slip-logo" src="/jtbazar-logo.webp" alt="JTBazar" /><small>ORDER PACKING SLIP</small></div><div className="slip-brand__order"><small>ORDER NUMBER</small><b>{order.order_number}</b></div></header>
      <div className="slip-columns"><section><h3>Ship to</h3><strong>{order.customer_name}</strong><p>{order.customer_phone}</p><p>{address}</p>{typeof shipping.delivery_instructions === 'string' && shipping.delivery_instructions && <small>Delivery note: {shipping.delivery_instructions}</small>}</section><section><h3>Order info</h3><p><b>Order date</b><span>{formatDate(order.created_at)}</span></p><p><b>Payment</b><span>{order.payment_method.toUpperCase()} · {order.payment_status}</span></p><p><b>Order status</b><span className="slip-status">{order.order_status}</span></p></section></div>
      <p className="admin-copy no-print">Product names are clickable. Select a product to view its complete catalogue details, variants and stock.</p><div className="slip-items"><table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{groupedItems.map((group, groupIndex) => { const quantity = group.rows.reduce((sum, item) => sum + Number(item.quantity), 0); const total = group.rows.reduce((sum, item) => sum + Number(item.line_total), 0); const variants = group.rows.map((item) => ({ item, label: formatVariantSnapshot(item.variant_snapshot) })); const skus = group.rows.map((item) => item.sku_snapshot).filter((sku): sku is string => Boolean(sku)); return <tr key={group.rows[0].id}><td><button type="button" className="admin-product-detail-link" disabled={!group.rows[0].product_id} onClick={() => group.rows[0].product_id && setSelectedProductId(group.rows[0].product_id)}>{groupIndex + 1}. {group.productName}</button>{variants.map(({ item, label }) => label ? <small key={item.id}>{label} · Qty {item.quantity}</small> : group.rows.length > 1 ? <small key={item.id}>Qty {item.quantity}</small> : null)}</td><td>{skus.length ? skus.map((sku, index) => <small key={sku + index}>{sku}</small>) : '—'}</td><td>{quantity}</td><td>{group.rows.length === 1 ? formatMoney(group.rows[0].unit_price) : <small>{group.rows.map((item) => formatMoney(item.unit_price)).join(' / ')}</small>}</td><td>{formatMoney(total)}</td></tr> })}</tbody></table></div>
      <div className="slip-total"><span>Subtotal</span><b>{formatMoney(order.subtotal)}</b><span>Delivery</span><b>{formatMoney(order.delivery_fee)}</b><span>Discount</span><b>− {formatMoney(order.discount_amount)}</b><strong>Grand total</strong><strong>{formatMoney(order.total)}</strong></div>
      <footer><strong>Thank you for shopping with JTBazar.</strong><span>We appreciate your order.</span></footer>
    </article>
    {selectedProductId && <AdminProductDetails id={selectedProductId} onClose={() => setSelectedProductId(null)} onEdit={() => setSelectedProductId(null)} />}
  </section>
}


function Inventory() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminInventory[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [variantOptions, setVariantOptions] = useState<AdminVariant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editQuantities, setEditQuantities] = useState<Record<string, string>>({})
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [newQuantity, setNewQuantity] = useState('0')
  const [newNote, setNewNote] = useState('Initial stock entry')
  const load = (quiet = false) => { if (!quiet) setLoading(true); setError(null); void listAdminInventory().then(setItems).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Inventory could not be loaded.')).finally(() => { if (!quiet) setLoading(false) }) }
  useEffect(load, [])
  useAutoRefresh(load)
  useEffect(() => {
    void listAdminProducts().then(setProducts).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Products could not be loaded for inventory.'))
  }, [])
  useEffect(() => {
    let active = true
    setVariantOptions([])
    setSelectedVariantId('')
    if (selectedProductId) void getAdminProductEditor(selectedProductId).then((detail) => { if (active) setVariantOptions(detail?.variants ?? []) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Product variants could not be loaded.') })
    return () => { active = false }
  }, [selectedProductId])
  const productGroups = Object.values(items.reduce<Record<string, { productId: string; productName: string; rows: AdminInventory[] }>>((groups, item) => { const group = groups[item.product_id] ?? { productId: item.product_id, productName: item.product_name, rows: [] }; group.rows.push(item); groups[item.product_id] = group; return groups }, {}))
  function startAdjust(group: { productId: string; rows: AdminInventory[] }) { setEditingProductId(group.productId); setEditQuantities(Object.fromEntries(group.rows.map((row) => [row.id, String(row.quantity)]))); setEditNote('') }
  async function saveAdjustment(event: FormEvent<HTMLFormElement>, rows: AdminInventory[]) {
    event.preventDefault()
    if (!editNote.trim()) { setError('Add one reason for this stock adjustment.'); return }
    const changes = rows.map((row) => ({ row, value: Number(editQuantities[row.id]) }))
    if (changes.some(({ value }) => !Number.isInteger(value) || value < 0)) { setError('Every variant quantity must be a whole number of zero or more.'); return }
    setSaving(true); setError(null)
    try { for (const change of changes) await adjustInventory(change.row.id, change.value, editNote.trim()); setEditingProductId(null); setEditNote(''); push('All product variant quantities updated.'); load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Inventory update failed. Some earlier rows may already have been saved; refresh before retrying.') }
    finally { setSaving(false) }
  }
  async function addOrUpdateStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(newQuantity)
    if (!selectedProductId) { setError('Select a product first.'); return }
    if (variantOptions.length > 0 && !selectedVariantId) { setError('Select the variant whose stock you want to manage.'); return }
    if (!Number.isInteger(value) || value < 0) { setError('Quantity must be a whole number of zero or more.'); return }
    if (!newNote.trim()) { setError('Enter a reason for this stock entry.'); return }
    setSaving(true); setError(null)
    try {
      await saveAdminProductInventory(selectedProductId, variantOptions.length ? selectedVariantId : null, value, newNote.trim())
      const product = products.find((row) => row.id === selectedProductId)
      push(`Stock saved for ${product?.name ?? 'product'}.`)
      setAddOpen(false); setSelectedProductId(''); setSelectedVariantId(''); setNewQuantity('0'); setNewNote('Initial stock entry')
      load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Stock could not be saved.') }
    finally { setSaving(false) }
  }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Stock control</p><h2>Inventory</h2><p className="admin-copy">Add stock records or update quantities for each individual product variant.</p></div><div className="admin-action-row"><button type="button" className="admin-button" onClick={() => setAddOpen((value) => !value)}><Plus size={15}/>{addOpen ? 'Close stock form' : 'Add / update stock'}</button><button type="button" className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15} /> Refresh</button></div></div>
    {addOpen && <form className="admin-panel admin-form admin-inventory-add" onSubmit={(event) => void addOrUpdateStock(event)}>
      <div className="admin-panel-heading"><div><p className="admin-kicker">Inventory entry</p><h3>Add or update product stock</h3><p className="admin-copy">Choose a product and, when it has options, select the exact variant. Saving enables inventory tracking for that product.</p></div></div>
      <div className="admin-form-grid">
        <label className="admin-form-span">Product<select required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        {variantOptions.length > 0 && <label className="admin-form-span">Variant<select required value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)}><option value="">Select variant</option>{variantOptions.map((variant) => <option key={variant.id} value={variant.id}>{variant.option_label}: {variant.option_value}{variant.sku ? ` · ${variant.sku}` : ''}</option>)}</select></label>}
        <label>Available quantity<input type="number" min="0" step="1" required value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)}/></label>
        <label className="admin-form-span">Reason<input required value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="e.g. Initial stock / supplier restock"/></label>
      </div>
      <div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={saving} onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="admin-button" disabled={saving || !selectedProductId}>{saving ? 'Saving…' : 'Save stock'}</button></div>
    </form>}
    {error && <ErrorState message={error} retry={load}/>}
    {loading ? <Loading/> : items.length === 0 ? <Empty title="No inventory records" detail="Use Add / update stock to create the first base-product or variant stock record." action={<button type="button" className="admin-button" onClick={() => setAddOpen(true)}><Plus size={15}/> Add inventory</button>}/> :
      <div className="admin-table-wrap"><TableTools/><table className="admin-table"><thead><tr><th>Product</th><th>Variants</th><th>Total quantity</th><th>Updated</th><th>Adjust</th></tr></thead><tbody>{productGroups.map((group) => { const total = group.rows.reduce((sum, row) => sum + Number(row.quantity), 0); const updated = group.rows.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, group.rows[0].updated_at); const low = group.rows.some((row) => row.low_stock_threshold !== null && row.quantity <= row.low_stock_threshold); return <tr key={group.productId}><td><strong>{group.productName}</strong></td><td>{group.rows.length === 1 && !group.rows[0].variant_id ? 'Default' : <><strong>{group.rows.length} variants</strong><small>{group.rows.map((row) => row.variant_name ?? 'Default').join(' · ')}</small></>}</td><td><strong className={low ? 'admin-low-stock' : ''}>{total}</strong></td><td>{formatDate(updated)}</td><td><button type="button" className="admin-small-button" onClick={() => startAdjust(group)}>Edit stock</button></td></tr> })}</tbody></table></div>}
    {editingProductId && (() => { const group = productGroups.find((entry) => entry.productId === editingProductId); if (!group) return null; return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingProductId(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-edit-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Inventory adjustment</p><h3 id="inventory-edit-title">{group.productName}</h3><p className="admin-copy">Edit every variant quantity together. Each variant remains a separate stock record.</p></div><button type="button" className="admin-icon-button" aria-label="Close inventory editor" disabled={saving} onClick={() => setEditingProductId(null)}><X size={18}/></button></div><form className="admin-form" onSubmit={(event) => void saveAdjustment(event, group.rows)}><div className="admin-form-grid">{group.rows.map((row) => <label key={row.id}>{row.variant_name ?? 'Default product'}<input type="number" min="0" step="1" required value={editQuantities[row.id] ?? '0'} onChange={(event) => setEditQuantities((current) => ({ ...current, [row.id]: event.target.value }))}/><small>Current: {row.quantity} · Threshold: {row.low_stock_threshold ?? 'Not set'}</small></label>)}<label className="admin-form-span">Adjustment reason<input required value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="e.g. Stock count / supplier restock"/></label></div><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={saving} onClick={() => setEditingProductId(null)}>Cancel</button><button type="submit" className="admin-button" disabled={saving}>{saving ? 'Saving…' : 'Save all quantities'}</button></div></form></section></div> })()}
  </section>
}
function Sellers() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminSeller[]>([])
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<AdminSeller | null>(null)
  const [reasonTarget, setReasonTarget] = useState<{ item: AdminSeller; status: 'rejected' | 'suspended' } | null>(null)
  const [reason, setReason] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const load = () => {
    setError(null)
    void listSellerApplications(status).then(setItems).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Seller applications could not be loaded.'))
  }
  useEffect(load, [status])
  useAutoRefresh(load)

  async function review(item: AdminSeller, next: AdminSeller['status'], reviewReason?: string) {
    try {
      setSavingReview(true)
      const result = await reviewSellerApplication(item.id, next, reviewReason) as { email_sent?: boolean; email_error?: string }
      const needsEmail = next === 'approved' || next === 'rejected'
      const emailed = result.email_sent
      const actionLabel = next === 'approved' ? 'Seller approved' : next === 'rejected' ? 'Seller application rejected' : `Seller ${next}`
      push(needsEmail && !emailed
        ? `${actionLabel}, but the email could not be sent. ${result.email_error ?? 'Check SMTP secrets and Edge Function logs.'}`
        : `${actionLabel}${needsEmail ? ' and email sent' : ''}.`, needsEmail && !emailed ? 'error' : 'success')
      setReasonTarget(null)
      setReason('')
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Seller review failed.', 'error')
    } finally {
      setSavingReview(false)
    }
  }

  function openReasonModal(item: AdminSeller, next: 'rejected' | 'suspended') {
    setReasonTarget({ item, status: next })
    setReason(item.rejection_reason ?? '')
  }

  function submitReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = reason.trim()
    if (clean.length < 3) {
      push('Enter a review reason of at least 3 characters.', 'error')
      return
    }
    if (clean.length > 1000) {
      push('The review reason must be 1,000 characters or fewer.', 'error')
      return
    }
    if (reasonTarget) void review(reasonTarget.item, reasonTarget.status, clean)
  }

  return <section className="admin-content">
    <div className="admin-page-heading">
      <div><p className="admin-kicker">Marketplace governance</p><h2>Seller applications</h2><p className="admin-copy">Review vendor contact, address and location details before approving applications.</p></div>
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="all">All</option>
      </select>
    </div>
    {error ? <ErrorState message={error} retry={load} /> : items.length === 0 ? <Empty title="No seller applications" detail="Change the filter to Pending to focus on applications awaiting review." /> :
      <div className="admin-table-wrap"><TableTools /><table className="admin-table">
        <thead><tr><th>Shop</th><th>Contact</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
        <tbody>{items.map((item) => <Fragment key={item.id}>
          <tr>
            <td className="admin-seller-shop-cell"><strong>{item.shop_name}</strong><small>{item.slug}</small></td>
            <td>{item.contact_email ?? '-'}{item.phone && <small>{item.phone}</small>}<SellerDocumentLink path={item.document_path} /></td>
            <td><em className={statusClass(item.status)}>{item.status}</em>{item.vendor_locked && <small className="admin-status admin-status--suspended">Locked</small>}{item.rejection_reason && <small>Review note: {item.rejection_reason}</small>}</td>
            <td>{formatDate(item.created_at)}</td>
            <td><div className="admin-action-row">
              <button type="button" className="admin-icon-button admin-seller-details-trigger" aria-label={`View details for ${item.shop_name}`} title="View shop details" onClick={() => setDetailsTarget(item)}><Eye size={17} /></button>
              {(item.status === 'pending' || item.status === 'rejected') && <button type="button" className="admin-small-button" onClick={() => void review(item, 'approved')}>Approve</button>}
              {(item.status === 'pending' || item.status === 'rejected') && <button type="button" className="admin-small-button admin-small-button--danger" onClick={() => openReasonModal(item, 'rejected')}>{item.status === 'rejected' ? 'Update rejection' : 'Reject'}</button>}
              {item.status === 'approved' && <button type="button" className="admin-small-button admin-small-button--danger" onClick={() => openReasonModal(item, 'suspended')}>Suspend</button>}
              {item.status === 'suspended' && <button type="button" className="admin-small-button" onClick={() => void review(item, 'approved')}>Reactivate</button>}<button type="button" className={item.vendor_locked ? 'admin-small-button' : 'admin-small-button admin-small-button--danger'} onClick={() => { const action = item.vendor_locked ? 'unlock' : 'lock'; if (!window.confirm(`Are you sure you want to ${action} ${item.shop_name}? ${item.vendor_locked ? 'The seller will be able to edit again.' : 'The seller will not be able to change shop, products or inventory.'}`)) return; void setAdminVendorLock(item.id, !item.vendor_locked).then(() => { push(item.vendor_locked ? 'Vendor unlocked. Seller editing is enabled again.' : 'Vendor locked. Database writes from this seller are blocked.', 'success'); load() }).catch((cause) => push(cause instanceof Error ? cause.message : 'Vendor lock could not be changed.', 'error')) }}>{item.vendor_locked ? 'Unlock vendor' : 'Lock vendor'}</button>
            </div></td>
          </tr>

        </Fragment>)}</tbody>
      </table></div>}
    {detailsTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsTarget(null) }}>
      <section className="admin-modal admin-seller-details-modal" role="dialog" aria-modal="true" aria-labelledby="seller-details-title">
        <div className="admin-panel-heading"><div><p className="admin-kicker">Seller application details</p><h3 id="seller-details-title">{detailsTarget.shop_name}</h3><p className="admin-copy">{detailsTarget.slug}</p></div><button type="button" className="admin-icon-button" aria-label="Close details" onClick={() => setDetailsTarget(null)}><X size={17} /></button></div>
        <div className="admin-seller-details">
          <section className="admin-seller-details__wide"><h4>Shop description</h4><p>{detailsTarget.description || 'No description provided.'}</p></section>
          <section><h4>Contact information</h4><p><strong>Email:</strong> {detailsTarget.contact_email || 'Not provided'}</p><p><strong>Phone:</strong> {detailsTarget.phone || 'Not provided'}</p></section>
          <section><h4>Identity and business details</h4><p><strong>Business type:</strong> {detailsTarget.vendor_type?.replace(/_/g, ' ') || 'Not provided'}</p><p><strong>Owner full legal name:</strong> {detailsTarget.owner_full_name || 'Not provided'}</p><p><strong>CNIC number:</strong> {detailsTarget.cnic_number || 'Not provided'}</p><p><strong>Shop location details:</strong> {detailsTarget.shop_location_text || 'Not provided'}</p></section>
          <section><h4>Application status</h4><p><strong>Status:</strong> {detailsTarget.status}</p><p><strong>Submitted:</strong> {formatDate(detailsTarget.created_at)}</p>{detailsTarget.vendor_locked && <p>Vendor account is locked.</p>}{detailsTarget.rejection_reason && <p><strong>Review note:</strong> {detailsTarget.rejection_reason}</p>}</section>
          <section><h4>Current address</h4><p>{detailsTarget.current_address || 'Not provided'}</p></section>
          <section><h4>Complete address</h4><p>{detailsTarget.complete_address || 'Not provided'}</p></section>
          <section><h4>Shop location</h4><p><strong>Area / map label:</strong> {detailsTarget.shop_location_label || 'Not provided'}</p><p><strong>Coordinates:</strong> {detailsTarget.shop_lat != null && detailsTarget.shop_lng != null ? `${detailsTarget.shop_lat}, ${detailsTarget.shop_lng}` : 'Not captured'}</p>{detailsTarget.shop_lat != null && detailsTarget.shop_lng != null && <a href={`https://www.google.com/maps?q=${detailsTarget.shop_lat},${detailsTarget.shop_lng}`} target="_blank" rel="noreferrer">Open shop location in Google Maps</a>}</section>
          <section><h4>CNIC front image</h4>{detailsTarget.cnic_front_path ? <><p>Private CNIC front image is available.</p><SellerDocumentLink path={detailsTarget.cnic_front_path} label="View CNIC front" /></> : <p>No CNIC front image uploaded.</p>}</section>
          <section><h4>CNIC back image</h4>{detailsTarget.cnic_back_path ? <><p>Private CNIC back image is available.</p><SellerDocumentLink path={detailsTarget.cnic_back_path} label="View CNIC back" /></> : <p>No CNIC back image uploaded.</p>}</section>
          <section><h4>Identity / business registration document</h4>{detailsTarget.document_path ? <><p>Private verification document is available.</p><SellerDocumentLink path={detailsTarget.document_path} label="View verification document" /></> : <p>No verification document uploaded.</p>}</section>
        </div>
      </section>
    </div>}
    {reasonTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingReview) { setReasonTarget(null); setReason('') } }}>
      <section className="admin-modal admin-seller-review-modal" role="dialog" aria-modal="true" aria-labelledby="seller-review-title">
        <div className="admin-panel-heading"><div><p className="admin-kicker">Vendor application review</p><h3 id="seller-review-title">{reasonTarget.status === 'rejected' ? 'Reject application' : 'Suspend vendor'}</h3></div><button type="button" className="admin-icon-button" aria-label="Close" disabled={savingReview} onClick={() => { setReasonTarget(null); setReason('') }}><X size={17}/></button></div>
        <p className="admin-copy">{reasonTarget.item.shop_name} · The vendor will see this note and can use it to correct a rejected application.</p>
        <form onSubmit={submitReason}>
          <label htmlFor="seller-review-reason">Reason / correction notes <span>*</span></label>
          <textarea id="seller-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} rows={5} placeholder="Explain what needs to be corrected…" />
          <div className="admin-action-row"><button type="button" className="admin-button admin-button--outline" disabled={savingReview} onClick={() => { setReasonTarget(null); setReason('') }}>Cancel</button><button type="submit" className={reasonTarget.status === 'rejected' ? 'admin-button admin-button--danger' : 'admin-button'} disabled={savingReview || reason.trim().length < 3}>{savingReview ? 'Saving…' : reasonTarget.status === 'rejected' ? 'Reject application' : 'Confirm suspension'}</button></div>
        </form>
      </section>
    </div>}
  </section>
}

function formatCaseVariant(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return typeof value === 'string' ? value : ''
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    if (entry === null || entry === undefined || entry === '') return ''
    if (typeof entry === 'object') return Object.entries(entry as Record<string, unknown>).map(([nestedKey, nestedValue]) => nestedValue == null ? '' : nestedKey + ': ' + String(nestedValue)).filter(Boolean).join(', ')
    return key.replace(/_/g, ' ') + ': ' + String(entry)
  }).filter(Boolean).join(' · ')
}

function formatCaseAddress(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const address = value as Record<string, unknown>
  return [address.address_line_1, address.address_line_2, address.area, address.city, address.province, address.postal_code, address.country]
    .filter((part) => typeof part === 'string' && part.trim()).join(', ')
}

function Cases() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminCaseDetail[]>([])
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => { setError(null); void listMarketplaceCases(status).then((rows) => { setItems(rows); setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : null) }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Marketplace cases could not be loaded.')) }
  useEffect(load, [status])
  useAutoRefresh(load)
  const selected = items.find((item) => item.id === selectedId) ?? null
  async function decide(item: AdminCaseDetail, next: AdminCaseDetail['status']) {
    const decision = window.prompt('Record the administrative decision', item.admin_decision ?? '')
    if (!decision?.trim()) return
    try {
      await decideMarketplaceCase(item.id, next, decision.trim())
      push('Case decision recorded.', 'success')
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Case decision failed.', 'error')
    }
  }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p className="admin-kicker">Returns, refunds and complaints</p><h2>Marketplace cases</h2></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="seller_responded">Seller responded</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="resolved">Resolved</option></select></div>
    {error ? <ErrorState message={error} retry={load} /> : items.length === 0 ? <Empty title="No cases" detail="Buyer returns, refund requests and complaints will appear here once submitted." /> : <div className="admin-table-wrap"><TableTools /><table className="admin-table"><thead><tr><th>Type</th><th>Customer reason</th><th>Order / product</th><th>Status</th><th>Opened</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td><em className={statusClass(item.case_type)}>{item.case_type}</em></td>
      <td>{item.reason}</td>
      <td><strong>{item.order?.order_number ?? item.order_id}</strong><small>{item.order_item?.product_name_snapshot ?? 'Product unavailable'}</small></td>
      <td><em className={statusClass(item.status)}>{item.status}</em></td>
      <td>{formatDate(item.created_at)}</td>
      <td><div className="admin-action-row"><button type="button" className="admin-small-button" onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}>{selectedId === item.id ? 'Hide details' : 'View details'}</button>{!['resolved', 'rejected'].includes(item.status) && <><button type="button" className="admin-small-button" onClick={() => void decide(item, 'approved')}>Approve</button><button type="button" className="admin-small-button admin-small-button--danger" onClick={() => void decide(item, 'rejected')}>Reject</button></>}</div>{item.admin_decision && <small>{item.admin_decision}</small>}</td>
    </tr>)}</tbody></table></div>}
    {selected && <article className="admin-case-detail">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Case details</p><h3>{selected.case_type.toUpperCase()} · {selected.order?.order_number ?? selected.order_id}</h3></div><button type="button" className="admin-icon-button" onClick={() => setSelectedId(null)}><X size={17} /></button></div>
      <div className="admin-case-detail__grid">
        <section><h4>Customer</h4><strong>{selected.order?.customer_name ?? 'Customer details unavailable'}</strong><p>{selected.order?.customer_phone ?? 'Phone not available'}</p><p>{selected.order?.customer_email ?? 'Email not provided'}</p><p>{formatCaseAddress(selected.order?.shipping_address_snapshot) || 'Delivery address unavailable'}</p></section>
        <section><h4>Order</h4><p><strong>{selected.order?.order_number ?? selected.order_id}</strong></p><p>Status: {selected.order?.order_status ?? 'Unknown'}</p><p>Placed: {selected.order?.created_at ? formatDate(selected.order.created_at) : formatDate(selected.created_at)}</p><p>Order total: {selected.order ? formatMoney(selected.order.total) : 'Unavailable'}</p></section>
        <section className="admin-case-detail__product"><h4>Product involved</h4>{selected.product_image_url && <img src={selected.product_image_url} alt={selected.order_item?.product_name_snapshot ?? 'Product image'} />}<div><strong>{selected.order_item?.product_name_snapshot ?? 'Product details unavailable'}</strong><p>SKU: {selected.order_item?.sku_snapshot ?? '—'}</p><p>Variant: {formatCaseVariant(selected.order_item?.variant_snapshot) || 'Standard item'}</p><p>Quantity: {selected.order_item?.quantity ?? '—'}</p><p>Unit price: {selected.order_item ? formatMoney(selected.order_item.unit_price) : '—'}</p><p>Line total: {selected.order_item ? formatMoney(selected.order_item.line_total) : '—'}</p>{selected.order_item?.seller_name_snapshot && <p>Seller: {selected.order_item.seller_name_snapshot}</p>}</div></section>
        <section className="admin-case-detail__reason"><h4>Customer reason</h4><p>{selected.reason}</p>{selected.seller_response && <><h4>Seller response</h4><p>{selected.seller_response}</p></>}{selected.admin_decision && <><h4>Marketplace decision</h4><p>{selected.admin_decision}</p></>}</section>
        <section className="admin-case-detail__evidence"><h4>Submitted evidence image</h4>{selected.evidence_url ? <a href={selected.evidence_url} target="_blank" rel="noreferrer"><img src={selected.evidence_url} alt="Customer-submitted case evidence" /><span>Open full-size evidence</span></a> : <p>Evidence image is not available. Check the private storage bucket and access policies.</p>}</section>
      </div>
    </article>}
  </section>
}

function SupportTickets() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminSupportInboxTicket[]>([])
  const [selected, setSelected] = useState<AdminSupportInboxTicket | null>(null)
  const [reply, setReply] = useState('')
  const [chatMessages, setChatMessages] = useState<AdminSupportChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [status, setStatus] = useState<AdminSupportInboxTicket['status']>('open')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = () => { setError(null); void listAdminSupportTickets().then(setItems).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Support tickets could not be loaded.')) }
  useEffect(load, [])
  useAutoRefresh(load)

  useEffect(() => {
    if (!selected) { setChatMessages([]); return }
    let active = true
    const refreshMessages = async () => {
      try {
        const rows = selected.ticket_kind === 'seller' ? await listAdminSellerSupportMessages(selected.id) : await listAdminCustomerSupportMessages(selected.id)
        if (active) setChatMessages(rows)
      } catch (cause) {
        if (active) push(cause instanceof Error ? cause.message : 'Chat messages could not be loaded.', 'error')
      } finally { if (active) setChatLoading(false) }
    }
    setChatLoading(true)
    void refreshMessages()
    const timer = window.setInterval(() => { void refreshMessages() }, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selected?.id, selected?.ticket_kind])

  function openChat(item: AdminSupportInboxTicket) {
    setSelected(item)
    setReply('')
    setStatus(item.status)
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !reply.trim() || saving) return
    setSaving(true)
    try {
      const message = reply.trim()
      const chatMessage = selected.ticket_kind === 'seller' ? await sendAdminSellerSupportMessage(selected.id, message) : await sendAdminCustomerSupportMessage(selected.id, message)
      setChatMessages((current) => [...current, chatMessage])
      const emailed = await updateAdminSupportTicket(selected, status, message)
      const updated = { ...selected, status, admin_response: message, updated_at: new Date().toISOString() }
      setSelected(updated)
      setItems((current) => current.map((item) => item.id === updated.id && item.ticket_kind === updated.ticket_kind ? updated : item))
      setReply('')
      push(emailed ? 'Reply sent and customer notified.' : 'Reply saved, but the email notification could not be sent.', emailed ? 'success' : 'error')
      void listAdminSupportTickets().then(setItems).catch(() => undefined)
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Reply could not be sent.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveStatus(nextStatus: AdminSupportInboxTicket['status']) {
    if (!selected || saving) return
    setStatus(nextStatus)
    setSaving(true)
    try {
      await setAdminSupportTicketStatus(selected, nextStatus)
      const updated = { ...selected, status: nextStatus, updated_at: new Date().toISOString() }
      setSelected(updated)
      setItems((current) => current.map((item) => item.id === updated.id && item.ticket_kind === updated.ticket_kind ? updated : item))
      push('Ticket status updated.', 'success')
    } catch (cause) {
      setStatus(selected.status)
      push(cause instanceof Error ? cause.message : 'Ticket status could not be updated.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return <section className="admin-content">
    <div className="admin-page-heading">
      <div><p className="admin-kicker">Customer and seller inbox</p><h2>Support inbox</h2><p className="admin-copy">Open a ticket to read the conversation and reply to the customer or seller.</p></div>
      <button className="admin-button admin-button--outline" onClick={() => load()}><RefreshCw size={15} /> Refresh</button>
    </div>
    <div className="admin-support-summary">
      <div><span>Total tickets</span><strong>{items.length}</strong></div>
      <div><span>Open</span><strong>{items.filter((item) => item.status === 'open').length}</strong></div>
      <div><span>In progress</span><strong>{items.filter((item) => item.status === 'in_progress').length}</strong></div>
      <div><span>Resolved</span><strong>{items.filter((item) => item.status === 'resolved').length}</strong></div>
    </div>
    {error ? <ErrorState message={error} retry={load} /> : items.length === 0 ? <Empty title="No support tickets" detail="Customer and seller support requests will appear here." /> : <div className="admin-table-wrap admin-support-table-wrap">
      <TableTools />
      <table className="admin-table admin-support-table">
        <thead><tr><th>Requester</th><th>Ticket</th><th>Latest message</th><th>Status</th><th>Last activity</th><th>Conversation</th></tr></thead>
        <tbody>{items.map((item) => <tr key={`${item.ticket_kind}-${item.id}`}>
          <td><div className="admin-support-requester"><span className="admin-support-avatar">{(item.requester_name || 'U').slice(0, 1).toUpperCase()}</span><span><strong>{item.requester_name}</strong><small>{item.ticket_kind === 'seller' ? 'Seller' : 'Customer'} · {item.requester_email || 'No email'}</small></span></div></td>
          <td><strong>{item.subject}</strong><small>Created {formatDate(item.created_at)}</small></td>
          <td><span className="admin-support-preview">{item.admin_response ? `JTBazar: ${item.admin_response}` : item.message}</span></td>
          <td><em className={statusClass(item.status)}>{item.status.replace('_', ' ')}</em></td>
          <td>{formatDate(item.updated_at)}</td>
          <td><button type="button" className="admin-small-button admin-support-open" onClick={() => openChat(item)}><MessageSquare size={14} /> Open chat</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {selected && <div className="admin-modal-backdrop admin-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null) }}>
      <section className="admin-chat-modal" role="dialog" aria-modal="true" aria-labelledby="support-chat-title">
        <header className="admin-chat-header">
          <div className="admin-chat-person"><span className="admin-support-avatar admin-support-avatar--large">{(selected.requester_name || 'U').slice(0, 1).toUpperCase()}</span><div><p className="admin-kicker">{selected.ticket_kind === 'seller' ? 'Seller support' : 'Customer support'}</p><h3 id="support-chat-title">{selected.requester_name}</h3><small>{selected.requester_email}</small></div></div>
          <button type="button" className="admin-icon-button" aria-label="Close support conversation" disabled={saving} onClick={() => setSelected(null)}><X size={18} /></button>
        </header>
        <div className="admin-chat-ticket-meta"><div><small>SUBJECT</small><strong>{selected.subject}</strong></div><div><small>CREATED</small><strong>{formatDate(selected.created_at)}</strong></div><label><small>TICKET STATUS</small><select value={status} disabled={saving} onChange={(event) => void saveStatus(event.target.value as AdminSupportInboxTicket['status'])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label></div>
        <div className="admin-chat-thread">
          <div className="admin-chat-day"><span>Ticket conversation</span></div>
          <article className="admin-chat-message admin-chat-message--customer"><div className="admin-chat-message-label"><strong>{selected.requester_name}</strong><small>{formatDate(selected.created_at)}</small></div><p>{selected.message}</p></article>
          {chatMessages.map((message) => <article className={`admin-chat-message admin-chat-message--${message.sender_role === 'admin' ? 'admin' : 'customer'}`} key={message.id}><div className="admin-chat-message-label"><strong>{message.sender_role === 'admin' ? 'JTBazar Support' : selected.requester_name}</strong><small>{formatDate(message.created_at)}</small></div><p>{message.message}</p></article>)}
          {chatLoading && <div className="admin-chat-empty">Loading conversation…</div>}
          {!chatLoading && chatMessages.length === 0 && selected.admin_response && <article className="admin-chat-message admin-chat-message--admin"><div className="admin-chat-message-label"><strong>JTBazar Support</strong><small>{formatDate(selected.updated_at)}</small></div><p>{selected.admin_response}</p></article>}
          {!chatLoading && chatMessages.length === 0 && !selected.admin_response && <div className="admin-chat-empty"><MessageSquare size={22}/><strong>No replies yet</strong><span>Send the first reply to start the conversation.</span></div>}
        </div>
        <form className="admin-chat-composer" onSubmit={(event) => void sendReply(event)}>
          <label htmlFor="support-chat-reply">Your reply</label>
          <textarea id="support-chat-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={4000} placeholder="Write a helpful reply to the customer or seller…" required />
          <div className="admin-chat-composer-footer"><small>{reply.length}/4000 characters · Reply will also be emailed when delivery is available.</small><button className="admin-button" disabled={saving || !reply.trim() || status === 'resolved'}>{saving ? 'Sending…' : <><Send size={15} /> Send reply</>}</button></div>
        </form>
      </section>
    </div>}
  </section>
}

function Customers() {
  const ownerAccountId = '74f4ccd5-04b0-485e-b776-eab4c2ca1371'
  const { push } = useToast()
  const [items, setItems] = useState<AdminCustomer[]>([])
  const [suspensions, setSuspensions] = useState<Map<string, AdminAccountSuspension>>(new Map())
  const [target, setTarget] = useState<AdminCustomer | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<AdminCustomer | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suspensionsAvailable, setSuspensionsAvailable] = useState(true)
  const [suspensionsError, setSuspensionsError] = useState<string | null>(null)
  const load = () => {
    setError(null)
    void Promise.allSettled([listAdminCustomers(), listAdminAccountSuspensions()]).then(([customersResult, suspensionsResult]) => {
      if (customersResult.status === 'rejected') { setError(customersResult.reason instanceof Error ? customersResult.reason.message : 'Customers could not be loaded.'); return }
      setItems(customersResult.value)
      if (suspensionsResult.status === 'fulfilled') {
        setSuspensions(new Map(suspensionsResult.value.map((row) => [row.user_id, row])))
        setSuspensionsAvailable(true)
        setSuspensionsError(null)
      } else {
        setSuspensions(new Map())
        setSuspensionsAvailable(false)
        setSuspensionsError(suspensionsResult.reason instanceof Error ? suspensionsResult.reason.message : String(suspensionsResult.reason ?? 'Unknown Supabase error'))
      }
    })
  }
  useEffect(load, []); useAutoRefresh(load)
  async function suspend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!target || reason.trim().length < 5) return
    setSaving(true)
    try { const result = await setAdminAccountSuspension(target.id, 'suspend', reason.trim()); push(result.email_sent ? 'Account suspended and notice emailed. Customer and vendor access are blocked.' : 'Account suspended, but the email notice could not be sent.', result.email_sent ? 'success' : 'error'); setTarget(null); setReason(''); load() }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Account could not be suspended.', 'error') }
    finally { setSaving(false) }
  }
  async function restore() {
    if (!restoreTarget) return
    setSaving(true)
    try { const result = await setAdminAccountSuspension(restoreTarget.id, 'restore'); push(result.email_sent ? 'Account restored and notice emailed.' : 'Account restored, but the email notice could not be sent.', result.email_sent ? 'success' : 'error'); setRestoreTarget(null); load() }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Account could not be restored.', 'error') }
    finally { setSaving(false) }
  }
  return <section className="admin-content"><div className="admin-page-heading"><div><p className="admin-kicker">Authorized customer records</p><h2>Customers</h2><p className="admin-copy">Suspend the shared sign-in to block both customer and vendor access for the same person.</p></div><button type="button" className="admin-button admin-button--outline" onClick={load}><RefreshCw size={15} /> Refresh</button></div>{!suspensionsAvailable && <div className="admin-inline-notice" role="status">Account suspension check failed: {suspensionsError ?? 'Unknown Supabase error'}. Customer records remain available. Confirm the migration and admin permissions.</div>}{error ? <ErrorState message={error} retry={load} /> : items.length === 0 ? <Empty title="No customer profiles" detail="Customer profiles will appear here after real accounts are created through Supabase Auth." /> : <div className="admin-table-wrap"><TableTools /><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime value</th><th>Joined</th><th>Account access</th><th>Action</th></tr></thead><tbody>{items.map((item) => { const suspension = suspensions.get(item.id); return <tr key={item.id}><td><div className="admin-product-cell"><span className="admin-avatar">{(item.full_name ?? 'C').slice(0, 1).toUpperCase()}</span><span><strong>{item.full_name ?? 'Unnamed customer'}</strong><small>{item.email ?? 'No email on file'}</small></span></div></td><td>{item.email ?? '—'}</td><td>{item.phone ?? '—'}</td><td>{item.order_count}</td><td>{formatMoney(item.lifetime_value)}</td><td>{formatDate(item.created_at)}</td><td>{item.id === ownerAccountId ? <><em className={statusClass('active')}>Active</em><small>Protected JTBazar owner account</small></> : suspension ? <><em className={statusClass('suspended')}>Suspended</em><small title={suspension.reason}>{suspension.reason}</small></> : <em className={statusClass('active')}>Active</em>}</td><td>{item.id === ownerAccountId ? <span className="admin-muted">Protected owner</span> : suspension ? <button type="button" className="admin-small-button" onClick={() => setRestoreTarget(item)}>Restore access</button> : <button type="button" className="admin-small-button admin-small-button--danger" disabled={!suspensionsAvailable} title={!suspensionsAvailable ? 'Apply the account-suspensions migration first' : undefined} onClick={() => { setReason(''); setTarget(item) }}><ShieldAlert size={14} /> Suspend</button>}</td></tr> })}</tbody></table></div>}
    {target && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="suspend-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Block account access</p><h3 id="suspend-title">Suspend {target.full_name || target.email || 'this account'}?</h3></div><button type="button" className="admin-icon-button" aria-label="Close suspension dialog" disabled={saving} onClick={() => setTarget(null)}><X size={17} /></button></div><p className="admin-copy">This blocks sign-in for this user, including both customer and vendor features. Record a reason for the admin log and account notice.</p><form onSubmit={(event) => void suspend(event)}><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={1000} rows={4} required placeholder="Explain why access is being suspended…" /></label><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</button><button className="admin-button admin-button--danger" disabled={saving || reason.trim().length < 5}>{saving ? 'Suspending…' : 'Confirm suspension'}</button></div></form></section></div>}
    {restoreTarget && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRestoreTarget(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div className="admin-panel-heading"><div><p className="admin-kicker">Restore sign-in</p><h3 id="restore-title">Restore {restoreTarget.full_name || restoreTarget.email || 'this account'}?</h3></div><button type="button" className="admin-icon-button" aria-label="Close restore dialog" disabled={saving} onClick={() => setRestoreTarget(null)}><X size={17} /></button></div><p className="admin-copy">This restores access to the shared account and its customer and vendor features.</p><div className="admin-form-actions"><button type="button" className="admin-button admin-button--outline" disabled={saving} onClick={() => setRestoreTarget(null)}>Cancel</button><button type="button" className="admin-button" disabled={saving} onClick={() => void restore()}>{saving ? 'Restoring…' : 'Restore access'}</button></div></section></div>}
  </section>
}

function SellerDocumentLink({ path, label = 'View document' }: { path: string | null; label?: string }) {
  const { push } = useToast()
  const [opening, setOpening] = useState(false)
  async function open() {
    if (!path) return
    setOpening(true)
    try {
      const url = await getVendorDocumentSignedUrl(path)
      if (!url) throw new Error('A signed document link could not be created.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'The verification document could not be opened.', 'error')
    } finally { setOpening(false) }
  }
  if (!path) return <small>No verification document uploaded</small>
  return <button className="admin-small-button" onClick={() => void open()} disabled={opening}>{opening ? 'Opening…' : label}</button>
}

type FoodMapPoint = { lat: number; lng: number }

function FoodLocationMap({ initialPoint, onSelect }: { initialPoint: FoodMapPoint | null; onSelect: (point: FoodMapPoint) => void }) {
  const mapElement = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cssId = 'jtbazar-leaflet-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const initialize = () => {
      if (cancelled || !mapElement.current || !(window as any).L || mapRef.current) return
      const L = (window as any).L
      const start = initialPoint ? [initialPoint.lat, initialPoint.lng] : [24.8607, 67.0011]
      const map = L.map(mapElement.current, { scrollWheelZoom: true }).setView(start, initialPoint ? 15 : 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
      }).addTo(map)
      mapRef.current = map
      const setPoint = (lat: number, lng: number) => {
        if (!markerRef.current) markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map)
        markerRef.current.setLatLng([lat, lng])
        markerRef.current.off('dragend')
        markerRef.current.on('dragend', (event: any) => {
          const point = event.target.getLatLng()
          onSelectRef.current({ lat: Number(point.lat.toFixed(7)), lng: Number(point.lng.toFixed(7)) })
        })
        onSelectRef.current({ lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) })
      }
      if (initialPoint) {
        markerRef.current = L.marker(start, { draggable: true }).addTo(map)
        markerRef.current.on('dragend', (event: any) => {
          const point = event.target.getLatLng()
          onSelectRef.current({ lat: Number(point.lat.toFixed(7)), lng: Number(point.lng.toFixed(7)) })
        })
      }
      map.on('click', (event: any) => setPoint(event.latlng.lat, event.latlng.lng))
      setMapReady(true)
      window.setTimeout(() => map.invalidateSize(), 100)
    }
    if ((window as any).L) initialize()
    else {
      let script = document.getElementById('jtbazar-leaflet-js') as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = 'jtbazar-leaflet-js'
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        document.body.appendChild(script)
      }
      script.addEventListener('load', initialize)
      if ((window as any).L) initialize()
    }
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null }
  }, [])

  function useCurrentLocation() {
    if (!navigator.geolocation) { setMapError('This browser does not support location access.'); return }
    setLocating(true)
    setMapError(null)
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: Number(position.coords.latitude.toFixed(7)), lng: Number(position.coords.longitude.toFixed(7)) }
      const L = (window as any).L
      if (mapRef.current && L) {
        mapRef.current.setView([point.lat, point.lng], 16)
        if (!markerRef.current) markerRef.current = L.marker([point.lat, point.lng], { draggable: true }).addTo(mapRef.current)
        markerRef.current.setLatLng([point.lat, point.lng])
        markerRef.current.off('dragend')
        markerRef.current.on('dragend', (event: any) => {
          const next = event.target.getLatLng()
          onSelectRef.current({ lat: Number(next.lat.toFixed(7)), lng: Number(next.lng.toFixed(7)) })
        })
      }
      onSelectRef.current(point)
      setLocating(false)
    }, (cause) => {
      setMapError(cause.code === 1 ? 'Location permission denied. Allow location access in your browser, or select the point manually on the map.' : 'Could not detect your location. Select the point manually on the map.')
      setLocating(false)
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 })
  }

  return <div className="admin-food-map-wrap">
    <div className="admin-food-map-toolbar"><span>Click the map or drag the pin to choose your pickup point.</span><button type="button" className="admin-button admin-button--outline" onClick={useCurrentLocation} disabled={locating}>{locating ? 'Detecting location…' : '◎ Use my current location'}</button></div>
    <div ref={mapElement} className="admin-food-location-map" role="application" aria-label="Select JTBazar food delivery operating location" />
    {!mapReady && <small className="admin-copy">Loading interactive map…</small>}
    {mapError && <p className="admin-error" role="alert">{mapError}</p>}
  </div>
}


const MARKETPLACE_HOUR_DAYS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
] as const
const DEFAULT_MARKETPLACE_HOURS: Record<string, { enabled: boolean; open: string; close: string; close_day_offset: number }> = Object.fromEntries(
  MARKETPLACE_HOUR_DAYS.map(([day]) => [day, { enabled: true, open: '07:00', close: day === 'sunday' ? '03:00' : '00:00', close_day_offset: 1 }]),
)

function StoreSettings() {
  const { push } = useToast()
  const [settings, setSettings] = useState<AdminStoreSettings | null>(null)
  const [foodLocation, setFoodLocation] = useState<AdminFoodDeliverySettings | null>(null)
  const [commissionSettings, setCommissionSettings] = useState<AdminCommissionSettings | null>(null)
  const [commissionCategories, setCommissionCategories] = useState<AdminCategory[]>([])
  const [commissionSaving, setCommissionSaving] = useState(false)
  const [foodLocationSaving, setFoodLocationSaving] = useState(false)
  const [selectedFoodPoint, setSelectedFoodPoint] = useState<FoodMapPoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = () => { setError(null); void getAdminStoreSettings().then(setSettings).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Store settings could not be loaded.')) }
  useEffect(load, [])
  useEffect(() => {
    void Promise.all([getAdminCommissionSettings(), listAdminCategories()])
      .then(([commission, categories]) => { setCommissionSettings(commission); setCommissionCategories(categories) })
      .catch((cause: unknown) => push(cause instanceof Error ? cause.message : 'Commission settings could not be loaded.', 'error'))
  }, [])
  useEffect(() => {
    void getAdminFoodDeliverySettings()
      .then((settings) => {
        setFoodLocation(settings)
        setSelectedFoodPoint(settings.hub_lat != null && settings.hub_lng != null ? { lat: settings.hub_lat, lng: settings.hub_lng } : null)
      })
      .catch((cause: unknown) => push(cause instanceof Error ? cause.message : 'Food delivery location could not be loaded.', 'error'))
  }, [])
  async function saveFoodLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const radius = Number(data.get('radius_km'))
    const lat = selectedFoodPoint?.lat ?? null
    const lng = selectedFoodPoint?.lng ?? null
    if ((lat === null) !== (lng === null)) { push('Select a location on the map before saving.', 'error'); return }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 50) { push('Delivery radius must be greater than 0 and no more than 50 km.', 'error'); return }
    setFoodLocationSaving(true)
    try {
      const next = await updateAdminFoodDeliverySettings({ hub_lat: lat, hub_lng: lng, radius_km: radius })
      setFoodLocation(next)
      push(lat === null ? 'JTBazar food delivery location cleared. Platform-owned food orders are now paused.' : 'Current operating location saved. JTBazar-owned food delivery radius is active.')
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Food delivery location could not be saved.', 'error')
    } finally { setFoodLocationSaving(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const deliveryFee = Number(data.get('delivery_fee'))
    const returnWindowDays = Number(data.get('return_window_days'))
    const additionalDeliveryFee = Number(data.get('additional_delivery_fee'))
    const freeDeliveryEnabled = data.get('free_delivery_enabled') === 'on'
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) { push('Delivery fee must be zero or more.', 'error'); return }
    if (!Number.isInteger(returnWindowDays) || returnWindowDays < 0) { push('Return window must be a whole number of days.', 'error'); return }
    if (!Number.isFinite(additionalDeliveryFee) || additionalDeliveryFee < 0) { push('Additional delivery fee must be zero or more.', 'error'); return }
    const supportEmail = String(data.get('support_email') ?? '').trim()
    const supportPhone = String(data.get('support_phone') ?? '').trim()
    const supportWhatsapp = String(data.get('support_whatsapp') ?? '').trim()
    if (supportEmail && !isValidEmail(supportEmail)) { push('Enter a valid support email address.', 'error'); return }
    if (supportPhone && !isValidPakistaniMobile(supportPhone)) { push('Support phone must be 03 followed by 9 digits or +923 followed by 9 digits (e.g. 03001234567, 03700822507, +923001234567 or +923700822507).', 'error'); return }
    if (supportWhatsapp && !isValidPakistaniMobile(supportWhatsapp)) { push('Support WhatsApp must be 03 followed by 9 digits or +923 followed by 9 digits (e.g. 03001234567, 03700822507, +923001234567 or +923700822507).', 'error'); return }
    let marketplaceHours: Record<string, { enabled: boolean; open: string; close: string; close_day_offset: number }>
    try { marketplaceHours = Object.fromEntries(MARKETPLACE_HOUR_DAYS.map(([day]) => {
      const enabled = data.get(`hours_enabled_${day}`) === 'on'
      const open = String(data.get(`hours_open_${day}`) ?? '07:00')
      const close = String(data.get(`hours_close_${day}`) ?? '00:00')
      const close_day_offset = Number(data.get(`hours_offset_${day}`) ?? 1)
      if (enabled && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) || ![0, 1].includes(close_day_offset) || (close_day_offset === 0 && close <= open))) {
        throw new Error(`Check the opening and closing times for ${day}.`)
      }
      return [day, { enabled, open, close, close_day_offset }]
    })) } catch (cause) { push(cause instanceof Error ? cause.message : 'Opening hours are invalid.', 'error'); return }
    setSaving(true)
    try {
      const next = await updateAdminStoreSettings({ store_name: String(data.get('store_name') ?? '').trim(), support_email: supportEmail || null, support_phone: supportPhone ? normalizePakistaniMobile(supportPhone) : null, support_whatsapp: supportWhatsapp ? normalizePakistaniMobile(supportWhatsapp) : null, delivery_fee: deliveryFee, free_delivery_enabled: freeDeliveryEnabled, additional_delivery_fee: additionalDeliveryFee, cod_enabled: data.get('cod_enabled') === 'on', return_window_days: returnWindowDays, marketplace_hours: marketplaceHours })
      setSettings(next); push('Store settings saved. Storefront visitors will see the updated values on their next visit.')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Store settings could not be saved.', 'error') } finally { setSaving(false) }
  }
  async function submitCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const defaultPercent = Number(data.get('default_commission'))
    if (!Number.isFinite(defaultPercent) || defaultPercent < 0 || defaultPercent > 100) { push('Default commission must be between 0 and 100%.', 'error'); return }
    const categoryRates: Record<string, number> = {}
    for (const category of commissionCategories) {
      const raw = String(data.get(`commission_${category.id}`) ?? '').trim()
      if (!raw) continue
      const rate = Number(raw)
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) { push(`Commission for ${category.name} must be between 0 and 100%.`, 'error'); return }
      categoryRates[category.id] = rate
    }
    setCommissionSaving(true)
    try {
      const saved = await updateAdminCommissionSettings({ default_percent: defaultPercent, category_rates: categoryRates })
      setCommissionSettings(saved)
      push('Commission settings saved. New and edited vendor listings will use these rates.')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Commission settings could not be saved.', 'error') }
    finally { setCommissionSaving(false) }
  }
  if (error) return <ErrorState message={error} retry={load} />
  if (!settings) return <Loading />
  return <section className="admin-content"><div className="admin-page-heading"><div><p className="admin-kicker">Storefront defaults and contact details</p><h2>Store settings</h2></div></div><form key={settings.updated_at} className="admin-form admin-panel" onSubmit={(event) => void submit(event)}><div className="admin-panel-heading"><div><h3>Public store configuration</h3><p className="admin-copy">These values are read by the storefront checkout, footer and help pages. Delivery fee and cash-on-delivery availability are enforced again by the database when an order is placed.</p></div></div><div className="admin-form-grid"><label className="admin-form-span">Store name<input name="store_name" defaultValue={settings.store_name} maxLength={160} required /></label><label>Support email<input name="support_email" type="email" defaultValue={settings.support_email ?? ''} placeholder="support@example.com" /></label><label>Support phone<input name="support_phone" type="tel" maxLength={13} pattern="(03[0-9]{9}|\+923[0-9]{9})" defaultValue={settings.support_phone ?? ''} placeholder="03001234567 or +923001234567" /></label><label>Support WhatsApp<input name="support_whatsapp" defaultValue={settings.support_whatsapp ?? ''} placeholder="+92 300 0000000" /></label><label>Standard delivery fee (PKR)<input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={settings.delivery_fee} required /></label><label>Additional delivery fee (PKR)<input name="additional_delivery_fee" type="number" min="0" step="0.01" defaultValue={settings.additional_delivery_fee} required /><small>Default 0: pending products can be delivered later without charging a second delivery fee.</small></label><label className="admin-check"><input name="free_delivery_enabled" type="checkbox" defaultChecked={settings.free_delivery_enabled} /> Enable free delivery</label><label>Return window (days)<input name="return_window_days" type="number" min="0" step="1" defaultValue={settings.return_window_days} required /></label><label className="admin-check"><input name="cod_enabled" type="checkbox" defaultChecked={settings.cod_enabled} /> Cash on delivery available</label></div><div className="admin-panel-heading"><div><h3>JTBazar Food &amp; Shops opening hours</h3><p className="admin-copy">These hours control the live OPEN NOW / SHOP CLOSED status and countdown shown on the customer homepage. Times use Pakistan Standard Time. Set closing day to “Next day” for overnight schedules.</p></div></div><div className="admin-hours-grid">{MARKETPLACE_HOUR_DAYS.map(([day, label]) => { const saved = ((settings as any).marketplace_hours ?? DEFAULT_MARKETPLACE_HOURS)[day] ?? DEFAULT_MARKETPLACE_HOURS[day]; return <div className="admin-hours-row" key={day}><label className="admin-check"><input name={`hours_enabled_${day}`} type="checkbox" defaultChecked={saved.enabled} /> {label}</label><label>Opens<input name={`hours_open_${day}`} type="time" defaultValue={saved.open} /></label><label>Closes<input name={`hours_close_${day}`} type="time" defaultValue={saved.close} /></label><label>Closing day<select name={`hours_offset_${day}`} defaultValue={String(saved.close_day_offset)}><option value="0">Same day</option><option value="1">Next day</option></select></label></div> })}</div><div className="admin-form-actions"><button className="admin-button" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div></form><form className="admin-form admin-panel" onSubmit={(event) => void submitCommission(event)}><div className="admin-panel-heading"><div><h3>Vendor commission settings</h3><p className="admin-copy">Vendors enter their own base price. JTBazar adds the configured commission once to calculate the customer price. Category rates override the default rate. Existing published listings are not repriced automatically.</p></div></div>{commissionSettings ? <><div className="admin-form-grid"><label>Default commission (%)<input name="default_commission" type="number" min="0" max="100" step="0.01" defaultValue={commissionSettings.default_percent} required /></label></div><div className="admin-hours-grid">{commissionCategories.map((category) => <label key={category.id}>{category.name} (%)<input name={`commission_${category.id}`} type="number" min="0" max="100" step="0.01" placeholder={`Use default (${commissionSettings.default_percent}%)`} defaultValue={commissionSettings.category_rates[category.id] ?? ''} /></label>)}</div><p className="admin-copy">Discounts are applied to the final customer price after commission is added. Commission is not added again at checkout, and category overrides apply to new or edited listings only.</p><div className="admin-form-actions"><button className="admin-button" disabled={commissionSaving}>{commissionSaving ? 'Saving…' : 'Save commission rates'}</button></div></> : <Loading />}</form><form key={foodLocation ? `${foodLocation.hub_lat ?? "none"}-${foodLocation.hub_lng ?? "none"}-${foodLocation.radius_km}` : "loading"} className="admin-form admin-panel" onSubmit={(event) => void saveFoodLocation(event)}><div className="admin-panel-heading"><div><h3>JTBazar food delivery operating location</h3><p className="admin-copy">No permanent warehouse is required. Use the map to select your current operating/pickup point whenever it changes. JTBazar-owned Food &amp; Groceries orders are accepted only within this radius. Vendor-owned food orders continue using each vendor shop location.</p></div></div><FoodLocationMap initialPoint={foodLocation?.hub_lat != null && foodLocation.hub_lng != null ? { lat: foodLocation.hub_lat, lng: foodLocation.hub_lng } : null} onSelect={setSelectedFoodPoint} /><div className="admin-form-grid"><label>Delivery radius (km)<input name="radius_km" type="number" min="0.1" max="50" step="0.1" defaultValue={foodLocation?.radius_km ?? 5} required /></label></div><p className="admin-copy">{selectedFoodPoint ? `Selected operating point: ${selectedFoodPoint.lat}, ${selectedFoodPoint.lng}` : foodLocation?.hub_lat != null && foodLocation.hub_lng != null ? `Saved operating point: ${foodLocation.hub_lat}, ${foodLocation.hub_lng}` : 'No current operating location selected. Use “Use my current location” or click the map; JTBazar-owned food orders remain blocked until you save a point.'}</p><div className="admin-form-actions"><button className="admin-button" disabled={foodLocationSaving || !foodLocation || !selectedFoodPoint}>{foodLocationSaving ? 'Saving…' : 'Save food delivery location'}</button></div></form></section>
}

function Audit() { const [items, setItems] = useState<Array<{ id: string; action: string; entity: string; entity_id: string | null; created_at: string }>>([]); const [error, setError] = useState<string | null>(null); const load = () => void listAuditLogs().then(setItems).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Audit log could not be loaded.')); useEffect(load, []); useAutoRefresh(load); return <section className="admin-content"><div className="admin-page-heading"><div><p className="admin-kicker">Sensitive changes</p><h2>Audit log</h2></div></div>{error ? <ErrorState message={error} retry={load} /> : items.length === 0 ? <Empty title="No audit events" detail="Product, category, inventory, note, and order status changes will be recorded by database triggers." /> : <div className="admin-table-wrap"><TableTools /><table className="admin-table"><thead><tr><th>Action</th><th>Entity</th><th>Entity ID</th><th>When</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><em className={statusClass(item.action.toLowerCase())}>{item.action}</em></td><td>{item.entity}</td><td className="admin-mono">{item.entity_id ?? '—'}</td><td>{formatDate(item.created_at)}</td></tr>)}</tbody></table></div>}</section> }

function Promotions() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPromo, setEditingPromo] = useState<AdminPromotion | null>(null)
  const [promoImages, setPromoImages] = useState<string[]>([])
  const [uploadingPromoImages, setUploadingPromoImages] = useState(false)

  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void listAdminPromotions()
      .then(setItems)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Promotions could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }

  useEffect(load, [])
  useAutoRefresh(load)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await saveAdminPromotion(
        {
          title: String(data.get('title') ?? '').trim(),
          description: String(data.get('description') ?? '').trim() || null,
          banner_image_url: promoImages[0] ?? null,
          banner_image_urls: promoImages,
          cta_text: String(data.get('cta_text') ?? '').trim() || null,
          cta_destination: String(data.get('cta_destination') ?? '').trim() || null,
          is_platform_wide: data.get('is_platform_wide') === 'on',
          status: String(data.get('status') ?? 'approved') as AdminPromotion['status'],
          display_position: String(data.get('display_position') ?? 'hero_banner'),
          target_platform: String(data.get('target_platform') ?? 'both') as AdminPromotion['target_platform'],
          campaign_type: String(data.get('campaign_type') ?? 'banner') as AdminPromotion['campaign_type'],
          show_on_launch: data.get('show_on_launch') === 'on',
          starts_at: String(data.get('starts_at') ?? '').trim() || null,
          ends_at: String(data.get('ends_at') ?? '').trim() || null,
          priority: Number(data.get('priority') ?? 0),
          coupon_code: String(data.get('coupon_code') ?? '').trim() || null,
          discount_percent: data.get('discount_percent') ? Number(data.get('discount_percent')) : null,
        },
        editingPromo?.id
      )
      push('Promotion campaign saved.')
      setShowForm(false)
      setEditingPromo(null)
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Promotion could not be saved.', 'error')
    }
  }

  async function removePromo(id: string) {
    if (!window.confirm('Delete this promotional campaign?')) return
    try {
      await deleteAdminPromotion(id)
      push('Promotion deleted.')
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Delete failed.', 'error')
    }
  }

  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Campaign management</p>
          <h2>Banners & Ads Manager</h2>
        </div>
        <button
          className="admin-button"
          onClick={() => {
            setEditingPromo(null)
            setPromoImages([])
            setShowForm(true)
          }}
        >
          <Plus size={16} /> New platform campaign
        </button>
      </div>

      {(showForm || editingPromo) && (
        <form className="admin-form admin-panel" onSubmit={(event) => void submit(event)}>
          <div className="admin-panel-heading">
            <h3>{editingPromo ? 'Edit campaign' : 'New platform promotion'}</h3>
            <button
              type="button"
              className="admin-icon-button"
              onClick={() => {
                setShowForm(false)
                setEditingPromo(null)
                setPromoImages([])
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="admin-form-grid">
            <label>
              Title <input name="title" defaultValue={editingPromo?.title ?? ''} required />
            </label>
            <label>
              Coupon code <input name="coupon_code" defaultValue={editingPromo?.coupon_code ?? ''} placeholder="e.g. SAVE20" />
            </label>
            <label>
              Discount % <input name="discount_percent" type="number" min="0" max="100" defaultValue={editingPromo?.discount_percent ?? ''} placeholder="20" />
            </label>
            <label>
              Display position
              <select name="display_position" defaultValue={editingPromo?.display_position ?? 'hero_banner'}>
                <option value="hero_banner">Hero Banner</option>
                <option value="seller_banner">Become a Seller Banner</option>
                <option value="top_promo">Top Promo Bar</option>
                <option value="category_feature">Category Feature</option>
                <option value="product_strip">Product Strip</option>
                <option value="offer_section">Offer Section</option>
              </select>
            </label>
            <label>
              Campaign type
              <select name="campaign_type" defaultValue={editingPromo?.campaign_type ?? 'banner'}>
                <option value="banner">Homepage banner</option>
                <option value="popup">Opening popup ad</option>
              </select>
            </label>
            <label>
              Show on
              <select name="target_platform" defaultValue={editingPromo?.target_platform ?? 'both'}>
                <option value="both">Website + Android app</option>
                <option value="website">Website only</option>
                <option value="android">Android app only</option>
              </select>
            </label>
            <label>
              Start date/time <input name="starts_at" type="datetime-local" defaultValue={editingPromo?.starts_at?.slice(0, 16) ?? ''} />
            </label>
            <label>
              End date/time <input name="ends_at" type="datetime-local" defaultValue={editingPromo?.ends_at?.slice(0, 16) ?? ''} />
            </label>
            <label className="admin-check">
              <input name="show_on_launch" type="checkbox" defaultChecked={editingPromo?.show_on_launch ?? false} /> Show popup on fresh app/website opening
            </label>
            <label>
              Priority <input name="priority" type="number" defaultValue={editingPromo?.priority ?? 0} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={editingPromo?.status ?? 'approved'}>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="admin-form-span">
              <span>Upload banner images</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={uploadingPromoImages}
                onChange={(event) => {
                  const input = event.currentTarget
                  const files = Array.from(input.files ?? [])
                  if (!files.length) return
                  setUploadingPromoImages(true)
                  void Promise.all(files.map((file) => uploadPublicMedia(file, 'promotions')))
                    .then((urls) => setPromoImages((current) => [...current, ...urls]))
                    .catch((cause) => push(cause instanceof Error ? cause.message : 'Banner images could not be uploaded.', 'error'))
                    .finally(() => {
                      setUploadingPromoImages(false)
                      input.value = ''
                    })
                }}
              />
              <small>Choose one or more JPG, PNG, WebP or AVIF images, up to 8 MB each.</small>
              {uploadingPromoImages && <small>Uploading images…</small>}
              {promoImages.length > 0 && (
                <div className="admin-promotion-image-list">
                  {promoImages.map((url, index) => (
                    <div className="admin-promotion-image" key={`${url}-${index}`}>
                      <img src={url} alt={`Campaign banner ${index + 1}`} />
                      <span>Image {index + 1}</span>
                      <button type="button" className="admin-icon-button" aria-label={`Remove image ${index + 1}`} onClick={() => setPromoImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </label>
            <label className="admin-form-span">
              <span>CTA text & link</span>
              <input name="cta_text" defaultValue={editingPromo?.cta_text ?? ''} placeholder="CTA Text" />
              <input name="cta_destination" defaultValue={editingPromo?.cta_destination ?? ''} placeholder="CTA Link e.g. /shop" />
            </label>
            <label className="admin-form-span">
              <span>Description</span>
              <textarea name="description" rows={3} defaultValue={editingPromo?.description ?? ''} />
            </label>
            <label className="admin-check">
              <input name="is_platform_wide" type="checkbox" defaultChecked={editingPromo?.is_platform_wide ?? true} /> Platform-wide promotion
            </label>
          </div>
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-button admin-button--outline"
              onClick={() => {
                setShowForm(false)
                setEditingPromo(null)
              }}
            >
              Cancel
            </button>
            <button className="admin-button" disabled={uploadingPromoImages}>{uploadingPromoImages ? 'Uploading…' : 'Save campaign'}</button>
          </div>
        </form>
      )}

      {error ? (
        <ErrorState message={error} retry={load} />
      ) : loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title="No promotional campaigns found"
          detail="Create platform-wide banners or review seller promotional submissions here."
        />
      ) : (
        <div className="admin-table-wrap"><TableTools />
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Placement</th>
                <th>Discount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.coupon_code ? `Code: ${item.coupon_code}` : 'No coupon code'}</small>
                  </td>
                  <td>{item.display_position}</td>
                  <td>{item.discount_percent ? `${item.discount_percent}% OFF` : 'Banner'}</td>
                  <td>{item.is_platform_wide ? 'Platform' : 'Vendor'}</td>
                  <td>
                    <em className={statusClass(item.status)}>{item.status}</em>
                  </td>
                  <td>
                    <div className="admin-action-row">
                      <button className="admin-icon-button" title="Edit" onClick={() => { setPromoImages(item.banner_image_urls?.length ? item.banner_image_urls : item.banner_image_url ? [item.banner_image_url] : []); setEditingPromo(item) }}>
                        <Edit2 size={15} />
                      </button>
                      <button className="admin-icon-button" title="Delete" onClick={() => void removePromo(item.id)}>
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Heroes() {
  const { push } = useToast()
  const [items, setItems] = useState<AdminHero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingHero, setEditingHero] = useState<AdminHero | null>(null)
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [savingHero, setSavingHero] = useState(false)

  useEffect(() => {
    if (!heroFile) { setHeroPreview(null); return }
    const preview = URL.createObjectURL(heroFile)
    setHeroPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [heroFile])

  const load = (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    void listAdminHeroes()
      .then(setItems)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Heroes could not be loaded.'))
      .finally(() => { if (!quiet) setLoading(false) })
  }

  useEffect(load, [])
  useAutoRefresh(load)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSavingHero(true)
    try {
      let imageUrl = editingHero?.image_url ?? ""
      if (heroFile) {
        imageUrl = await uploadPublicMedia(heroFile, "heroes")
      } else if (String(data.get("image_url") ?? "").trim()) {
        imageUrl = String(data.get("image_url") ?? "").trim()
      }
      if (!imageUrl) throw new Error('Choose a hero image or enter an image URL.')
      if (!/^https:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) throw new Error('Use an HTTPS image URL.')

      await saveAdminHero(
        {
          title: String(data.get("title") ?? "").trim(),
          subtitle: String(data.get("subtitle") ?? "").trim() || null,
          cta_text: String(data.get("cta_text") ?? "").trim() || null,
          cta_destination: String(data.get("cta_destination") ?? "").trim() || null,
          image_url: imageUrl,
          display_order: Number(data.get("display_order") ?? 0),
          status: String(data.get("status") ?? "published") as AdminHero["status"],
        },
        editingHero?.id
      )
      push("Hero slide saved.")
      setShowForm(false)
      setEditingHero(null)
      setHeroFile(null)
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : "Hero slide could not be saved.", "error")
    } finally {
      setSavingHero(false)
    }
  }

  async function removeHero(id: string) {
    if (!window.confirm('Delete this hero slide?')) return
    try {
      await deleteAdminHero(id)
      push('Hero slide deleted.')
      load()
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Delete failed.', 'error')
    }
  }

  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Storefront branding</p>
          <h2>Homepage Heroes</h2>
        </div>
        <button
          className="admin-button"
          onClick={() => {
            setEditingHero(null)
            setHeroFile(null)
            setShowForm(true)
          }}
        >
          <Plus size={16} /> New hero slide
        </button>
      </div>

      {(showForm || editingHero) && (
        <form className="admin-form admin-panel" onSubmit={(event) => void submit(event)}>
          <div className="admin-panel-heading">
            <h3>{editingHero ? 'Edit hero slide' : 'New hero slide'}</h3>
            <button
              type="button"
              className="admin-icon-button"
              onClick={() => {
                setShowForm(false)
                setEditingHero(null)
                setHeroFile(null)
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="admin-form-grid">
            <label>
              Title <input name="title" defaultValue={editingHero?.title ?? ''} required />
            </label>
            <label>
              Subtitle <input name="subtitle" defaultValue={editingHero?.subtitle ?? ''} />
            </label>
            <label>
              CTA text <input name="cta_text" defaultValue={editingHero?.cta_text ?? ''} placeholder="e.g. Shop Now" />
            </label>
            <label>
              CTA destination <input name="cta_destination" defaultValue={editingHero?.cta_destination ?? ''} placeholder="e.g. /shop" />
            </label>
            <label className="admin-form-span">
              <span>Hero image (JPG, PNG, WebP or AVIF; max 8 MB)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && (file.size > 8 * 1024 * 1024 || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))) { push('Choose a JPG, PNG, WebP or AVIF image up to 8 MB.', 'error'); event.target.value = ''; setHeroFile(null); return } setHeroFile(file) }} />
              <small>Upload a file or use an existing hosted image URL.</small>
              <input name="image_url" defaultValue={editingHero?.image_url ?? ''} placeholder="https://..." />
              {(heroPreview || editingHero?.image_url) && <img src={heroPreview ?? editingHero?.image_url ?? ''} alt="Hero image preview" style={{ display: 'block', maxWidth: 420, maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 10 }} />}
            </label>
            <label>
              Display order <input name="display_order" type="number" defaultValue={editingHero?.display_order ?? 0} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={editingHero?.status ?? 'published'}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-button admin-button--outline"
              onClick={() => {
                setShowForm(false)
                setEditingHero(null)
                setHeroFile(null)
              }}
            >
              Cancel
            </button>
            <button className="admin-button" disabled={savingHero}>{savingHero ? "Saving…" : "Save hero slide"}</button>
          </div>
        </form>
      )}

      {error ? (
        <ErrorState message={error} retry={load} />
      ) : loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title="No homepage heroes configured"
          detail="Create your first hero slide to customize the storefront homepage hero banner dynamically."
        />
      ) : (
        <div className="admin-table-wrap"><TableTools />
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>CTA Link</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle || 'No subtitle'}</small>
                  </td>
                  <td>{item.cta_destination || '—'}</td>
                  <td>{item.display_order}</td>
                  <td>
                    <em className={statusClass(item.status)}>{item.status}</em>
                  </td>
                  <td>
                    <div className="admin-action-row">
                      <button className="admin-icon-button" title="Edit" onClick={() => setEditingHero(item)}>
                        <Edit2 size={15} />
                      </button>
                      <button className="admin-icon-button" title="Delete" onClick={() => void removeHero(item.id)}>
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}


function ManualOrders() {
  type ManualItem = { mode: 'catalog' | 'custom'; product_id: string; category_id: string; product_search: string; seller_id: string; product_name_snapshot: string; quantity: number; unit_price: number; seller_name_snapshot: string; sku_snapshot: string }
  const emptyItem = (): ManualItem => ({ mode: 'catalog', product_id: '', category_id: '', product_search: '', seller_id: '', product_name_snapshot: '', quantity: 1, unit_price: 0, seller_name_snapshot: '', sku_snapshot: '' })
  const { push } = useToast()
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [source, setSource] = useState('whatsapp')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [orderStatus, setOrderStatus] = useState('pending')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [paidAmount, setPaidAmount] = useState('0')
  const [formItems, setFormItems] = useState<ManualItem[]>([emptyItem()])
  const subtotal = formItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0), 0)
  const total = Math.max(0, subtotal + (Number(deliveryFee) || 0) - (Number(discount) || 0))
  const load = () => {
    setLoading(true); setError(null)
    void (async () => {
      try {
        const client = getSupabase() as any
        const { data, error: queryError } = await client.from('manual_orders').select('*').order('created_at', { ascending: false }).limit(200)
        if (queryError) throw new Error(queryError.message)
        setItems((data ?? []) as Record<string, unknown>[])
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Manual orders could not be loaded.') }
      finally { setLoading(false) }
    })()
  }
  const loadProducts = () => { setProductsLoading(true); void listAdminProducts('').then(setProducts).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Products could not be loaded.')).finally(() => setProductsLoading(false)) }
  const editManualOrder = async (row: Record<string, unknown>) => {
    const id = String(row.id ?? '')
    if (!id) { push('Order ID missing; this record cannot be edited.', 'error'); return }
    setError(null)
    try {
      const client = getSupabase() as any
      const [orderResult, itemResult] = await Promise.all([
        client.from('manual_orders').select('*').eq('id', id).single(),
        client.from('manual_order_items').select('*').eq('manual_order_id', id).order('created_at')
      ])
      if (orderResult.error) throw new Error(orderResult.error.message)
      if (itemResult.error) throw new Error(itemResult.error.message)
      const order = orderResult.data as Record<string, unknown>
      setEditingOrderId(id)
      setCustomerName(String(order.customer_name ?? ''))
      setPhone(String(order.customer_phone ?? ''))
      setEmail(String(order.customer_email ?? ''))
      setAddress(String(order.shipping_address ?? ''))
      setNote(String(order.customer_note ?? ''))
      setReference(String(order.external_reference ?? ''))
      setSource(String(order.source ?? 'other'))
      setPaymentMethod(String(order.payment_method ?? 'cod'))
      setOrderStatus(String(order.order_status ?? 'pending'))
      setDeliveryFee(String(order.delivery_fee ?? 0))
      setDiscount(String(order.discount_amount ?? 0))
      setPaidAmount(String(order.paid_amount ?? 0))
      const savedItems = (itemResult.data ?? []) as Record<string, unknown>[]
      setFormItems(savedItems.length ? savedItems.map(item => {
        const productId = String(item.product_id ?? '')
        const productExists = products.some(product => product.id === productId)
        return {
          mode: productExists ? 'catalog' as const : 'custom' as const,
          product_id: productExists ? productId : '',
          category_id: productExists ? (products.find(product => product.id === productId)?.category_id ?? '') : '',
          product_search: productExists ? (products.find(product => product.id === productId)?.name ?? '') : '',
          seller_id: String(item.seller_id ?? ''),
          product_name_snapshot: String(item.product_name_snapshot ?? ''),
          quantity: Number(item.quantity ?? 1),
          unit_price: Number(item.unit_price ?? 0),
          seller_name_snapshot: String(item.seller_name_snapshot ?? ''),
          sku_snapshot: String(item.sku_snapshot ?? '')
        }
      }) : [emptyItem()])
      setFormOpen(true)
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Manual order could not be loaded for editing.', 'error')
    }
  }
  const deleteManualOrder = async (row: Record<string, unknown>) => {
    const id = String(row.id ?? '')
    if (!id) { push('Order ID missing; this record cannot be removed.', 'error'); return }
    const number = String(row.manual_order_number ?? 'this order')
    if (!window.confirm(`Remove manual order ${number} and its associated items?`)) return
    try {
      const client = getSupabase() as any
      const { error: deleteError } = await client.rpc('admin_delete_manual_order', { p_order_id: id })
      if (deleteError) throw new Error(deleteError.message)
      setItems(current => current.filter(item => String(item.id ?? '') !== id))
      push(`Manual order ${number} removed.`, 'success')
    } catch (cause) {
      push(cause instanceof Error ? cause.message : 'Manual order could not be removed.', 'error')
    }
  }
  useEffect(() => { load(); loadProducts(); void listAdminCategories().then(setCategories).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Categories could not be loaded.')) }, [])
  const value = (row: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) { const v = row[key]; if (v !== null && v !== undefined && v !== '') return String(v) }
    return '—'
  }
  const resetForm = () => {
    setCustomerName(''); setPhone(''); setEmail(''); setAddress(''); setNote(''); setReference('')
    setSource('whatsapp'); setPaymentMethod('cod'); setOrderStatus('pending')
    setDeliveryFee('0'); setDiscount('0'); setPaidAmount('0'); setFormItems([emptyItem()])
  }
  const changeItemMode = (index: number, mode: 'catalog' | 'custom') => setFormItems(v => v.map((item,i) => i === index ? { ...item, mode, product_id: '', category_id: '', product_search: '', seller_id: '', product_name_snapshot: '', unit_price: 0, seller_name_snapshot: '', sku_snapshot: '' } : item))
  const selectProduct = (index: number, productId: string) => { const product = products.find(p => p.id === productId); setFormItems(v => v.map((item,i) => i === index ? { ...item, product_id: product?.id ?? '', category_id: product?.category_id ?? item.category_id, product_search: product?.name ?? '', seller_id: (product as any)?.seller_id ?? '', product_name_snapshot: product?.name ?? '', unit_price: Number(product?.price ?? 0), seller_name_snapshot: '', sku_snapshot: product?.sku ?? '' } : item)) }
  const saveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidPakistaniMobile(phone)) { push('Enter 03 followed by 9 digits or +923 followed by 9 digits.', 'error'); return }
    if (email.trim() && !isValidEmail(email.trim())) { push('Enter a valid customer email address.', 'error'); return }
    if (!formItems.length || formItems.some(item => !item.product_name_snapshot.trim() || Number(item.quantity) < 1 || Number(item.unit_price) < 0 || (item.mode === 'catalog' && !item.product_id))) {
      setError('Har item ka naam, quantity (kam az kam 1) aur valid price enter karein.'); return
    }
    setSaving(true); setError(null)
    try {
      const client = getSupabase() as any
      const { data, error: saveError } = await client.rpc('admin_save_manual_order', {
        p_order_id: editingOrderId,
        p_order: {
          source, customer_name: customerName, customer_phone: normalizePakistaniMobile(phone), customer_email: email.trim() || null,
          shipping_address: address, customer_note: note, external_reference: reference,
          delivery_fee: Number(deliveryFee) || 0, discount_amount: Number(discount) || 0,
          paid_amount: Number(paidAmount) || 0, payment_method: paymentMethod, order_status: orderStatus
        },
        p_items: formItems.map(item => ({
          product_id: item.mode === 'catalog' ? item.product_id : null,
          seller_id: item.mode === 'catalog' ? (item.seller_id || null) : null,
          product_name_snapshot: item.product_name_snapshot.trim(),
          quantity: Number(item.quantity), unit_price: Number(item.unit_price),
          seller_name_snapshot: item.seller_name_snapshot.trim(), sku_snapshot: item.sku_snapshot.trim(),
          variant_snapshot: {}
        }))
      })
      if (saveError) throw new Error(saveError.message)
      const created = Array.isArray(data) ? data[0] : data
      resetForm(); setFormOpen(false); load()
      push(`Manual order ${created?.manual_order_number ?? ''} saved successfully.`, 'success')
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Manual order save nahi ho saka.', 'error') }
    finally { setSaving(false) }
  }
  const fieldStyle = { width: '100%', minWidth: 0, padding: '10px 12px', border: '1px solid var(--admin-border, #d9dee7)', borderRadius: '8px', background: 'var(--admin-surface, #fff)', color: 'inherit', font: 'inherit' }
  const labelStyle = { display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 as const }
  return <section className="admin-content">
    <div className="admin-page-heading">
      <div><p className="admin-kicker">Phone, WhatsApp and walk-in sales</p><h2>Manual Orders</h2><p className="admin-copy">Admin yahan customer ki phone, WhatsApp, social media ya shop wali order manually add kar sakta hai.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="admin-button" onClick={() => { setError(null); if (!products.length) loadProducts(); setFormOpen(v => !v) }}><Plus size={15} /> {formOpen ? 'Close form' : 'Add Manual Order'}</button>
        <button className="admin-button admin-button--outline" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
    </div>
    {error && <ErrorState message={error} retry={() => { setError(null); loadProducts() }} />}
    {formOpen && <form className="admin-panel" onSubmit={saveOrder} style={{display:'grid',gap:18,marginBottom:20}}>
      <div className="admin-panel-heading"><div><p className="admin-kicker">{editingOrderId ? 'Edit order' : 'New order'}</p><h3>Customer and delivery details</h3></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14}}>
        <label style={labelStyle}>Customer name *<input style={fieldStyle} required value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer full name" /></label>
        <label style={labelStyle}>Phone / WhatsApp *<input style={fieldStyle} required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="03001234567 or +923001234567" maxLength={13} pattern="(03[0-9]{9}|\+923[0-9]{9})" /></label>
        <label style={labelStyle}>Email (optional)<input style={fieldStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@example.com" /></label>
        <label style={labelStyle}>Order source *<select style={fieldStyle} value={source} onChange={e=>setSource(e.target.value)}>{[['whatsapp','WhatsApp'],['instagram','Instagram'],['facebook','Facebook'],['phone','Phone call'],['walk_in','Walk-in / shop'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <label style={labelStyle}>Delivery address *<textarea style={fieldStyle} required value={address} onChange={e=>setAddress(e.target.value)} rows={2} placeholder="Full delivery address" /></label>
      <div className="admin-panel-heading"><div><p className="admin-kicker">Order items</p><h3>Products and quantities</h3></div><button type="button" className="admin-button admin-button--outline" onClick={()=>setFormItems(v=>[...v,emptyItem()])}><Plus size={14}/> Add item</button></div>
      {formItems.map((item,index)=><div key={index} style={{display:'grid',gap:12,padding:14,border:'1px solid var(--admin-border, #d9dee7)',borderRadius:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><strong>Item {index+1}</strong><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button type="button" className={item.mode==='catalog'?'admin-button':'admin-button admin-button--outline'} onClick={()=>changeItemMode(index,'catalog')}>Select catalog product</button>
          <button type="button" className={item.mode==='custom'?'admin-button':'admin-button admin-button--outline'} onClick={()=>changeItemMode(index,'custom')}>Custom product</button>
          <button type="button" className="admin-icon-button" aria-label="Remove item" disabled={formItems.length===1} onClick={()=>setFormItems(v=>v.filter((_,i)=>i!==index))}><X size={15}/></button>
        </div></div>
        {item.mode==='catalog' ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
          <label style={labelStyle}>Category<select style={fieldStyle} value={item.category_id} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,category_id:e.target.value,product_id:'',product_name_snapshot:'',seller_id:'',unit_price:0,sku_snapshot:'',product_search:''}:x))}><option value="">All categories</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label style={labelStyle}>Search product<input style={fieldStyle} type="search" value={item.product_search} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,product_search:e.target.value,product_id:'',product_name_snapshot:'',seller_id:'',unit_price:0,sku_snapshot:''}:x))} placeholder="Type product name or SKU"/></label>
          <label style={{...labelStyle,gridColumn:'1 / -1'}}>Product dropdown *<select style={fieldStyle} required value={item.product_id} onChange={e=>selectProduct(index,e.target.value)}><option value="">{productsLoading?'Loading products…':'Choose a product'}</option>{products.filter(product=>(!item.category_id||product.category_id===item.category_id)&&(!item.product_search.trim()||product.name.toLowerCase().includes(item.product_search.trim().toLowerCase())||(product.sku??'').toLowerCase().includes(item.product_search.trim().toLowerCase()))).map(product=><option key={product.id} value={product.id}>{product.name} · {product.food_selling_unit ? `${formatMoney(product.food_unit_price ?? 0)} / ${product.food_selling_unit} (step ${formatMoney(product.price)})` : formatMoney(product.price)}{product.sku? ' · SKU '+product.sku:''}</option>)}</select><small>{productsLoading?'Loading catalog…':products.filter(product=>(!item.category_id||product.category_id===item.category_id)&&(!item.product_search.trim()||product.name.toLowerCase().includes(item.product_search.trim().toLowerCase())||(product.sku??'').toLowerCase().includes(item.product_search.trim().toLowerCase()))).length+' matching products'}</small></label>
        </div> :
          <label style={labelStyle}>Custom product name *<input style={fieldStyle} required value={item.product_name_snapshot} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,product_name_snapshot:e.target.value}:x))} placeholder="Enter product not available in catalog"/></label>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12}}>
          <label style={labelStyle}>Quantity *<input style={fieldStyle} type="number" min="1" max="999" required value={item.quantity} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,quantity:Number(e.target.value)}:x))}/></label>
          <label style={labelStyle}>Unit price (PKR) *<input style={fieldStyle} type="number" min="0" step="0.01" required value={item.unit_price} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,unit_price:Number(e.target.value)}:x))}/></label>
          <label style={labelStyle}>Seller (optional)<input style={fieldStyle} value={item.seller_name_snapshot} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,seller_name_snapshot:e.target.value}:x))} placeholder="Seller name"/></label>
          <label style={labelStyle}>SKU (optional)<input style={fieldStyle} value={item.sku_snapshot} onChange={e=>setFormItems(v=>v.map((x,i)=>i===index?{...x,sku_snapshot:e.target.value}:x))} placeholder="SKU"/></label>
        </div>
      </div>)}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14}}>
        <label style={labelStyle}>Delivery fee (PKR)<input style={fieldStyle} type="number" min="0" step="0.01" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)}/></label>
        <label style={labelStyle}>Discount (PKR)<input style={fieldStyle} type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
        <label style={labelStyle}>Payment method<select style={fieldStyle} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{[['cod','Cash on delivery'],['cash','Cash paid'],['bank_transfer','Bank transfer'],['card','Card'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label style={labelStyle}>Order status<select style={fieldStyle} value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}>{[['pending','Pending'],['processing','Processing'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label style={labelStyle}>Amount paid (PKR)<input style={fieldStyle} type="number" min="0" max={total} step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}/></label>
        <label style={labelStyle}>External reference (optional)<input style={fieldStyle} value={reference} onChange={e=>setReference(e.target.value)} placeholder="WhatsApp ref / receipt no."/></label>
      </div>
      <label style={labelStyle}>Order note (optional)<textarea style={fieldStyle} value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Customer instructions or internal note"/></label>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',paddingTop:12,borderTop:'1px solid var(--admin-border, #d9dee7)'}}>
        <div><div style={{fontSize:13,color:'var(--admin-muted,#64748b)'}}>Subtotal: PKR {subtotal.toLocaleString('en-PK')} · Delivery: PKR {(Number(deliveryFee)||0).toLocaleString('en-PK')} · Discount: PKR {(Number(discount)||0).toLocaleString('en-PK')}</div><strong style={{fontSize:20}}>Total: PKR {total.toLocaleString('en-PK')}</strong></div>
        <button className="admin-button" type="submit" disabled={saving}>{saving ? <><RefreshCw size={15} className="spin"/> Saving…</> : <><Check size={15}/> {editingOrderId ? 'Update Manual Order' : 'Save Manual Order'}</>}</button>
      </div>
    </form>}
    <div className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Saved records</p><h3>{items.length} manual orders</h3></div></div>
      {loading ? <Loading /> : items.length === 0 ? <Empty title="No manual orders yet" detail="Add the first order using the “Add Manual Order” button above." /> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order number</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>{items.map((row,index)=><tr key={value(row,'id')==='—'?index:value(row,'id')}><td><Link className="admin-link-button" to={`/admin/manual-orders/${value(row,'id')}`}><strong>{value(row,'manual_order_number','order_number','id')}</strong><small>{value(row,'source')}</small></Link></td><td>{value(row,'customer_name')}<small>{value(row,'customer_email')}</small></td><td>{value(row,'customer_phone')}</td><td>{formatMoney(value(row,'total'))}</td><td><em className={statusClass(value(row,'order_status'))}>{value(row,'order_status')}</em></td><td>{formatDate(value(row,'created_at'))}</td><td><div className="admin-action-row"><button type="button" className="admin-small-button" onClick={() => void editManualOrder(row)} title={`Edit ${value(row,'manual_order_number')}`}><Edit2 size={14}/> Edit</button><button type="button" className="admin-small-button admin-small-button--danger" onClick={() => void deleteManualOrder(row)} title={`Remove ${value(row,'manual_order_number')}`}><Trash2 size={14}/> Delete</button></div></td></tr>)}</tbody></table></div>}
    </div>
  </section>
}


function ManualOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = () => {
    setLoading(true); setError(null)
    void (async () => {
      try {
        const client = getSupabase() as any
        const [orderResult, itemsResult] = await Promise.all([
          client.from('manual_orders').select('*').eq('id', orderId).single(),
          client.from('manual_order_items').select('*').eq('manual_order_id', orderId).order('created_at')
        ])
        if (orderResult.error) throw new Error(orderResult.error.message)
        if (itemsResult.error) throw new Error(itemsResult.error.message)
        setOrder(orderResult.data as Record<string, unknown>)
        setItems((itemsResult.data ?? []) as Record<string, unknown>[])
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Manual order details could not be loaded.') }
      finally { setLoading(false) }
    })()
  }
  useEffect(() => { load() }, [orderId])
  const v = (key: string, fallback = '—') => { const value = order?.[key]; return value === null || value === undefined || value === '' ? fallback : String(value) }
  if (loading) return <div className="admin-content"><Loading /></div>
  if (error || !order) return <div className="admin-content"><div className="admin-page-heading"><Link className="admin-button admin-button--outline" to="/admin/manual-orders"><ArrowLeft size={15}/> All manual orders</Link></div><ErrorState message={error ?? 'Manual order not found.'} retry={load}/></div>
  return <section className="admin-content">
    <div className="admin-page-heading no-print"><div><p className="admin-kicker">Manual order details</p><h2>{v('manual_order_number')}</h2><p className="admin-copy">Created {formatDate(v('created_at'))} · Source: {v('source')}</p></div><div className="admin-action-row"><Link className="admin-button admin-button--outline" to="/admin/manual-orders"><ArrowLeft size={15}/> All manual orders</Link><button className="admin-button" onClick={() => window.print()}><Printer size={15}/> Print order slip</button></div></div>
    <div className="admin-grid-2 no-print">
      <div className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">Customer & delivery</p><h3>{v('customer_name')}</h3></div><em className={statusClass(v('order_status'))}>{v('order_status')}</em></div><p>{v('customer_phone')}</p><p>{v('customer_email','No email provided')}</p><p className="admin-copy">{v('shipping_address')}</p>{v('customer_note','') && <p className="admin-callout">{v('customer_note','')}</p>}{v('external_reference','') && <p>Reference: {v('external_reference')}</p>}</div>
      <div className="admin-panel"><p className="admin-kicker">Payment & totals</p><h3>{formatMoney(v('total'))}</h3><p>{v('payment_method').toUpperCase()} · {v('payment_status')}</p><p className="admin-copy">Subtotal {formatMoney(v('subtotal'))} · Delivery {formatMoney(v('delivery_fee'))} · Discount {formatMoney(v('discount_amount'))}</p><p>Paid: {formatMoney(v('paid_amount'))}</p><small>Updated {formatDate(v('updated_at'))}</small></div>
    </div>
    <article className="admin-order-slip">
      <header className="slip-brand"><div className="slip-brand__identity"><img className="slip-logo" src="/jtbazar-logo.webp" alt="JTBazar"/><small>MANUAL ORDER SLIP</small></div><div className="slip-brand__order"><small>ORDER NUMBER</small><b>{v('manual_order_number')}</b></div></header>
      <div className="slip-columns"><section><h3>Customer & delivery</h3><strong>{v('customer_name')}</strong><p>{v('customer_phone')}</p>{v('customer_email','') && <p>{v('customer_email')}</p>}<p>{v('shipping_address')}</p>{v('customer_note','') && <small>Note: {v('customer_note')}</small>}</section><section><h3>Order info</h3><p><b>Order date</b><span>{formatDate(v('created_at'))}</span></p><p><b>Source</b><span>{v('source')}</span></p><p><b>Payment</b><span>{v('payment_method')} · {v('payment_status')}</span></p><p><b>Status</b><span className="slip-status">{v('order_status')}</span></p><p><b>Reference</b><span>{v('external_reference')}</span></p></section></div>
      <div className="slip-items"><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{items.map((item,index)=><tr key={String(item.id ?? index)}><td><strong>{String(item.product_name_snapshot ?? '—')}</strong><small>{String(item.seller_name_snapshot ?? '')}</small></td><td>{String(item.sku_snapshot ?? '—')}</td><td>{Number(item.quantity ?? 0)}</td><td>{formatMoney(String(item.unit_price ?? 0))}</td><td>{formatMoney(String(item.line_total ?? (Number(item.quantity ?? 0)*Number(item.unit_price ?? 0))))}</td></tr>)}</tbody></table></div>
      <div className="slip-total"><span>Subtotal</span><b>{formatMoney(v('subtotal'))}</b><span>Delivery</span><b>{formatMoney(v('delivery_fee'))}</b><span>Discount</span><b>− {formatMoney(v('discount_amount'))}</b><strong>Grand total</strong><strong>{formatMoney(v('total'))}</strong></div>
      <footer><strong>Thank you for shopping with JTBazar.</strong><span>We appreciate your order.</span></footer>
    </article>
  </section>
}




function PushNotifications() {
  const { push } = useToast()
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [testing, setTesting] = useState(false)
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadCustomers() {
    setLoadingCustomers(true); setError(null)
    try { const rows = await listAdminCustomers(); setCustomers(rows); if (!selectedUser && rows.length) setSelectedUser(rows[0].id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Customer list could not be loaded.') }
    finally { setLoadingCustomers(false) }
  }
  useEffect(() => { void loadCustomers() }, [])

  async function sendTest() {
    setTesting(true); setTestResult(null)
    try {
      if (!selectedUser) throw new Error('Choose a customer to test first.')
      const result = await sendAdminPushTest(selectedUser)
      if (result.sent > 0) {
        setTestResult(`Delivered to ${result.sent} registered device(s).${result.failed ? ` ${result.failed} device(s) failed.` : ''}`)
        push('Test notification sent.', 'success')
      } else {
        setTestResult(result.message || 'No registered device found for this customer. Sign in to JTBazar and enable notifications first.')
        push('No registered device found.', 'error')
      }
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Test push failed.'; setTestResult(message); push(message, 'error') }
    finally { setTesting(false) }
  }
  async function sendManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUser) { push('Select a customer first.', 'error'); return }
    if (!window.confirm('Send this notification to the selected customer?')) return
    setSending(true)
    try { await sendAdminManualNotification(selectedUser, title, body); push('Notification sent and saved to inbox.', 'success'); setTitle(''); setBody('') }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Notification could not be sent.', 'error') }
    finally { setSending(false) }
  }
  const selectedCustomer = customers.find(customer => customer.id === selectedUser)
  return <section className="admin-content push-center">
    <div className="push-hero">
      <div className="push-hero__icon"><Bell size={24} /></div>
      <div className="push-hero__copy"><span className="push-eyebrow">COMMUNICATION CENTER</span><h2>Push Notifications</h2><p>Test delivery or send an update directly to a JTBazar customer.</p></div>
      <button type="button" className="push-refresh" onClick={() => void loadCustomers()} disabled={loadingCustomers}><RefreshCw size={15} className={loadingCustomers ? 'push-spin' : ''} /> Refresh</button>
    </div>
    <div className="push-stats">
      <div className="push-stat"><span className="push-stat__icon"><Users size={17}/></span><div><small>Customers</small><strong>{loadingCustomers ? '—' : customers.length}</strong></div></div>
      <div className="push-stat"><span className="push-stat__icon push-stat__icon--firebase"><Bell size={17}/></span><div><small>Push provider</small><strong>Firebase FCM</strong><em>Connected</em></div></div>
      <div className="push-stat"><span className="push-stat__icon"><ShieldAlert size={17}/></span><div><small>Delivery method</small><strong>Registered devices</strong><em>Device permission required</em></div></div>
    </div>
    {error && <ErrorState message={error} retry={() => void loadCustomers()} />}
    <div className="push-layout">
      <div className="push-main">
        <section className="push-card">
          <div className="push-card__heading"><div><span className="push-step">01 · RECIPIENT</span><h3>Choose customer</h3><p>Select who should receive the test or manual notification.</p></div><Users size={20}/></div>
          <label className="push-label">Customer account</label>
          <select className="push-select" value={selectedUser} onChange={event => { setSelectedUser(event.target.value); setTestResult(null) }} disabled={loadingCustomers || !customers.length}>
            <option value="">{loadingCustomers ? 'Loading customers…' : 'Select a customer'}</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.full_name || 'Unnamed customer'} · {customer.email || customer.phone || customer.id.slice(0,8)}</option>)}
          </select>
          {selectedCustomer && <div className="push-selected"><span className="push-avatar">{(selectedCustomer.full_name || 'C').trim().charAt(0).toUpperCase()}</span><div><strong>{selectedCustomer.full_name || 'Customer'}</strong><small>{selectedCustomer.email || selectedCustomer.phone || 'Contact unavailable'}</small></div><Check size={17}/></div>}
        </section>
        <section className="push-card push-test-card">
          <div className="push-card__heading"><div><span className="push-step">02 · DELIVERY CHECK</span><h3>Test notification</h3><p>Send a real test push to the selected customer's registered device.</p></div><span className="push-card-symbol"><Bell size={20}/></span></div>
          {testResult && <div className="push-result" role="status"><Info size={16}/>{testResult}</div>}
          <button type="button" className="push-primary" onClick={() => void sendTest()} disabled={testing || !selectedUser}>{testing ? <><RefreshCw size={16} className="push-spin"/> Sending test…</> : <><Send size={16}/> Send test notification</>}</button>
        </section>
      </div>
      <section className="push-card push-compose">
        <div className="push-card__heading"><div><span className="push-step">03 · MANUAL MESSAGE</span><h3>Compose notification</h3><p>Write a clear message for the selected customer.</p></div><span className="push-card-symbol"><MessageSquare size={20}/></span></div>
        <form onSubmit={event => void sendManual(event)}>
          <label className="push-label" htmlFor="push-title">Notification title</label>
          <input id="push-title" className="push-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Your order is on its way" required/>
          <div className="push-counter">{title.length}/120</div>
          <label className="push-label" htmlFor="push-body">Message</label>
          <textarea id="push-body" className="push-textarea" value={body} onChange={event => setBody(event.target.value)} rows={5} maxLength={500} placeholder="Write your message here…" required/>
          <div className="push-counter">{body.length}/500</div>
          <div className="push-compose__foot"><small><ShieldAlert size={14}/> Also saved in the customer's notification inbox</small><button className="push-primary" disabled={sending || !selectedUser || !title.trim() || !body.trim()}>{sending ? 'Sending…' : <><Send size={16}/> Send notification</>}</button></div>
        </form>
      </section>
    </div>
  </section>
}
