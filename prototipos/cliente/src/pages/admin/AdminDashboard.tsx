import { Link } from 'react-router';
import { products, sampleOrders, formatPrice } from '../../data';

const statusLabel: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-[#F8EDE8] text-[#B8623F]' },
  pagado: { label: 'Pagado', color: 'bg-[#EDF3EF] text-[#3E5C4B]' },
  enviado: { label: 'Enviado', color: 'bg-[#EDF3EF] text-[#3E5C4B]' },
  entregado: { label: 'Entregado', color: 'bg-[#EDF3EF] text-[#3E5C4B]' },
  cancelado: { label: 'Cancelado', color: 'bg-[#F9F1E6] text-[#6B6259]' },
};

const lowStockProducts = products.filter(p => p.stock <= 10).slice(0, 5);
const recentOrders = sampleOrders.slice(0, 5);
const totalRevenue = sampleOrders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0);
const pendingOrders = sampleOrders.filter(o => o.status === 'pendiente').length;

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#2A2521]">Resumen</h1>
        <p className="text-sm text-[#6B6259] mt-0.5">Bienvenido al panel de administración de Nido Hogar</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ingresos totales', value: formatPrice(totalRevenue), icon: '💰', change: '+12%', positive: true },
          { label: 'Pedidos pendientes', value: pendingOrders, icon: '📋', change: `${pendingOrders} nuevos`, positive: false },
          { label: 'Productos activos', value: products.filter(p => p.active).length, icon: '📦', change: 'de ' + products.length + ' total', positive: true },
          { label: 'Con poco stock', value: lowStockProducts.length, icon: '⚠️', change: 'Atención requerida', positive: false },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-[#E6DBC9] p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[#6B6259]">{kpi.label}</p>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-[#2A2521] mb-1">{kpi.value}</p>
            <p className={`text-xs ${kpi.positive ? 'text-[#3E5C4B]' : 'text-[#B8623F]'}`}>{kpi.change}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E6DBC9]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6DBC9]">
            <h2 className="text-sm font-semibold text-[#2A2521]">Pedidos recientes</h2>
            <Link to="/admin/pedidos" className="text-xs text-[#3E5C4B] font-semibold hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-[#E6DBC9]">
            {recentOrders.map(order => (
              <div key={order.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#2A2521]">{order.number}</p>
                    {order.paymentMethod === 'transfer' && order.status === 'pendiente' && (
                      <span className="text-xs bg-[#F8EDE8] text-[#B8623F] px-1.5 py-0.5 rounded font-semibold">Verificar</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B6259] truncate">{order.customer} · {order.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#2A2521]">{formatPrice(order.total)}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel[order.status]?.color}`}>
                    {statusLabel[order.status]?.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-xl border border-[#E6DBC9]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6DBC9]">
            <h2 className="text-sm font-semibold text-[#2A2521]">Poco stock</h2>
            <Link to="/admin/productos" className="text-xs text-[#3E5C4B] font-semibold hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-[#E6DBC9]">
            {lowStockProducts.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#F9F1E6] flex-shrink-0">
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#2A2521] truncate">{p.name}</p>
                  <p className="text-xs text-[#6B6259]">{p.sku}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${p.stock <= 5 ? 'bg-[#F8EDE8] text-[#B8623F]' : 'bg-[#F9F1E6] text-[#6B6259]'}`}>
                  {p.stock} ud.
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 bg-white rounded-xl border border-[#E6DBC9] p-5">
        <h2 className="text-sm font-semibold text-[#2A2521] mb-4">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/productos/nuevo" className="flex items-center gap-2 px-4 py-2.5 bg-[#3E5C4B] text-white text-sm font-semibold rounded-lg hover:bg-[#2e4437] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
            </svg>
            Nuevo producto
          </Link>
          <Link to="/admin/descuentos" className="flex items-center gap-2 px-4 py-2.5 border border-[#E6DBC9] text-[#2A2521] text-sm font-semibold rounded-lg hover:bg-[#F9F1E6] transition-colors">
            Crear descuento
          </Link>
          <Link to="/admin/pedidos" className="flex items-center gap-2 px-4 py-2.5 border border-[#E6DBC9] text-[#2A2521] text-sm font-semibold rounded-lg hover:bg-[#F9F1E6] transition-colors">
            Ver pedidos pendientes
          </Link>
        </div>
      </div>
    </div>
  );
}
