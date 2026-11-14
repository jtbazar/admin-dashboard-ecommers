import { useEffect, useMemo, useState } from 'react'
import { Film, Plus, RefreshCw, Trash2, Upload, Video } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { deleteAdminProductVideo, listAdminProductVideos, listAdminProductsPage, uploadAdminProductVideo, type AdminProductVideo, type AdminProduct } from '../services/admin/adminService'

const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, color: 'var(--admin-text,#172033)', fontSize: 13, fontWeight: 650 }
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 42, border: '1px solid var(--admin-border,#d9dee7)', borderRadius: 10, padding: '9px 12px', background: 'var(--admin-panel,#fff)', color: 'inherit' }

export function ProductVideos() {
  const { push } = useToast()
  const [videos, setVideos] = useState<AdminProductVideo[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productId, setProductId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [preview, setPreview] = useState('')
  const pageSize = 12

  async function load() {
    setLoading(true); setError(null)
    try {
      const result = await listAdminProductVideos(page, pageSize)
      setVideos(result.items); setCount(result.count)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Product videos could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [page])
  useEffect(() => {
    let active = true
    setProductsLoading(true)
    const timer = window.setTimeout(() => {
      void listAdminProductsPage(productSearch, 0, 12, null, 'approved', false)
        .then(result => { if (active) setProducts(result.items) })
        .catch(cause => { if (active) push(cause instanceof Error ? cause.message : 'Products could not be searched.', 'error') })
        .finally(() => { if (active) setProductsLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [productSearch])

  const selectedProduct = useMemo(() => products.find(product => product.id === productId), [products, productId])
  function chooseFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(next); setDuration(null); setPreview('')
    if (!next) return
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(next.type)) { setFile(null); push('Choose an MP4, WebM or MOV video.', 'error'); return }
    if (next.size > 25 * 1024 * 1024) { setFile(null); push('Video must be 25 MB or smaller.', 'error'); return }
    const url = URL.createObjectURL(next)
    setPreview(url)
  }
  async function save() {
    if (!productId || !file || !duration) { push('Select a product and a valid video first.', 'error'); return }
    if (duration > 60) { push('Video duration cannot exceed 60 seconds.', 'error'); return }
    setSaving(true)
    try {
      await uploadAdminProductVideo(file, productId, Math.ceil(duration))
      push('Product video uploaded and linked successfully.', 'success')
      setFile(null); setDuration(null); setPreview(''); setProductId(''); setProductSearch('')
      setShowForm(false); setPage(0); await load()
    } catch (cause) { push(cause instanceof Error ? cause.message : 'Video upload failed.', 'error') }
    finally { setSaving(false) }
  }
  async function remove(video: AdminProductVideo) {
    if (!window.confirm('Delete this product video permanently?')) return
    try { await deleteAdminProductVideo(video); push('Product video deleted.', 'success'); await load() }
    catch (cause) { push(cause instanceof Error ? cause.message : 'Video could not be deleted.', 'error') }
  }

  return <section className="admin-content">
    <div className="admin-page-heading">
      <div><p className="admin-kicker">Product media library</p><h2>Product Videos</h2><p className="admin-copy">Upload a short product video and link it to one live catalog product.</p></div>
      <button className="admin-button" onClick={() => setShowForm(value => !value)}><Plus size={15}/>{showForm ? 'Close form' : 'Add Product Video'}</button>
    </div>
    {showForm && <div className="admin-panel" style={{ marginBottom: 18 }}>
      <div className="admin-panel-heading"><div><p className="admin-kicker">New video</p><h3>Upload and link a product</h3></div><Film size={21}/></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={labelStyle}>Search product<input style={inputStyle} type="search" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search product name or SKU"/></label>
          <label style={labelStyle}>Select product<select style={inputStyle} value={productId} onChange={event => setProductId(event.target.value)}><option value="">{productsLoading ? 'Searching products…' : 'Choose product'}</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ' · '+product.sku : ''}</option>)}</select></label>
          {selectedProduct && <small className="admin-copy">Linked product: {selectedProduct.name}</small>}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={labelStyle}>Upload video (MP4 / WebM / MOV)<input style={inputStyle} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => chooseFile(event.target.files?.[0] ?? null)}/></label>
          <small className="admin-copy">Maximum 60 seconds · Maximum 25 MB. Keep videos compressed for fast mobile loading.</small>
          {file && <small>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB {duration ? '· '+Math.ceil(duration)+' sec' : '· Reading duration…'}</small>}
        </div>
      </div>
      {preview && <div style={{ marginTop: 14, maxWidth: 320 }}>
        <video src={preview} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 260, borderRadius: 12, background: '#111' }}
          onLoadedMetadata={event => { const seconds = event.currentTarget.duration; setDuration(Number.isFinite(seconds) ? seconds : null); if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) push('Video must be between 1 and 60 seconds.', 'error') }}/>
      </div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button className="admin-button admin-button--outline" onClick={() => { setShowForm(false); chooseFile(null) }}>Cancel</button>
        <button className="admin-button" disabled={saving || !productId || !file || !duration || duration > 60} onClick={() => void save()}>{saving ? <><RefreshCw size={15} className="spin"/> Uploading…</> : <><Upload size={15}/> Save Product Video</>}</button>
      </div>
    </div>}
    <div className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-kicker">Saved videos</p><h3>{count} linked product videos</h3></div><button className="admin-button admin-button--outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
      {error ? <div className="admin-state admin-state--error">{error}<button className="admin-button admin-button--outline" onClick={() => void load()}>Try again</button></div> : loading ? <div className="admin-state"><RefreshCw size={18} className="spin"/> Loading product videos…</div> : videos.length === 0 ? <div className="admin-empty"><Video size={25}/><strong>No product videos yet</strong><p>Upload a short video and link it to a catalog product.</p></div> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Video</th><th>Linked product</th><th>Duration</th><th>File size</th><th>Added</th><th>Actions</th></tr></thead><tbody>
          {videos.map(video => <tr key={video.id}><td><a className="admin-link-button" href={video.video_url} target="_blank" rel="noreferrer"><Video size={15}/> Preview video</a></td><td><strong>{video.product_name}</strong></td><td>{video.duration_seconds}s</td><td>{(video.file_size_bytes / 1024 / 1024).toFixed(1)} MB</td><td>{new Date(video.created_at).toLocaleDateString()}</td><td><button className="admin-small-button admin-small-button--danger" onClick={() => void remove(video)}><Trash2 size={14}/> Delete</button></td></tr>)}
        </tbody></table></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}><small>Showing {videos.length} of {count} · 12 per page</small><div className="admin-action-row"><button className="admin-small-button" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(count / pageSize))}</span><button className="admin-small-button" disabled={(page + 1) * pageSize >= count || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </div>
  </section>
}
