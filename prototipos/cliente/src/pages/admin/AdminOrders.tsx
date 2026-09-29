import { useState } from 'react';
import { sampleOrders, formatPrice } from '../../data';
import type { Order } from '../../data';

const allStatuses = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'] as const;

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-[#F8EDE8] text-[#B8623F]' },
  pagado: { label: 'Pagado', color: 'bg-[#EDF3EF] text-[#3E5C4B]' },
  enviado: { label: 'Enviado', color: 'bg-[#EDF3EF] text-[#3E5C4B]' },
  entregado: { label: 'Entregado', color: 'bg-[#D1E4D9] text-[#3E5C4B]' },
  cancelado: { label: 'Cancelado', color: 'bg-[#F9F1E6] text-[#6B6259]' },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter(o => !statusFilter || o.status === statusFilter);

  const updateStatus = (id: string, status: Order['status']) => {
    setOrders(list => list.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder(o => o ? { ...o, status } : o);
  };

  const counts = allStatuses.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#2A2521]">Pedidos</h1>
        <p className="text-sm text-[#6B6259] mt-0.5">{orders.length} pedidos en total</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${!statusFilter ? 'bg-[#3E5C4B] text-white' : 'bg-white border border-[#E6DBC9] text-[#6B6259] hover:text-[#2A2521]'}`}
        >
          Todos ({orders.length})
        </button>
        {allStatuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
              statusFilter === s ? 'bg-[#3E5C4B] text-white' : 'bg-white border border-[#E6DBC9] text-[#6B6259] hover:text-[#2A2521]'
            }`}
          >
            {statusConfig[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-[#E6DBC9] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6DBC9]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B6259]">Pedido</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] hidden md:table-cell">Cliente</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259]">Total</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] hidden sm:table-cell">Pago</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259]">Estado</th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-[#6B6259] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DBC9]">
                  {filtered.map(order => (
                    <tr
                      key={order.id}
                      className={`hover:bg-[#F9F1E6] transition-colors cursor-pointer ${selectedOrder?.id === order.id ? 'bg-[#EDF3EF]' : ''}`}
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#2A2521]">{order.number}</p>
                        <p className="text-xs text-[#6B6259]">{order.date}</p>
                        {order.paymentMethod === 'transfer' && order.hasComprobante === false && order.status === 'pendiente' && (
                          <span className="text-xs text-[#B8623F] font-semibold">Sin comprobante</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-[#2A2521]">{order.customer}</p>
                        <p className="text-xs text-[#6B6259] truncate max-w-[140px]">{order.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[#2A2521]">{formatPrice(order.total)}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-[#6B6259]">
                          {order.paymentMethod === 'card' ? '💳 Tarjeta' : '🏦 Transferencia'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig[order.status]?.color}`}>
                          {statusConfig[order.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedOrder(selectedOrder?.id === order.id ? null : order); }}
                          className="text-xs text-[#3E5C4B] font-semibold hover:underline"
                        >
                          Detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[#6B6259] text-sm">No hay pedidos con este filtro</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedOrder && (
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-xl border border-[#E6DBC9] p-5 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#2A2521]">{selectedOrder.number}</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-[#6B6259] hover:text-[#2A2521]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 text-xs mb-4">
                <div>
                  <p className="text-[#6B6259]">Cliente</p>
                  <p className="font-semibold text-[#2A2521]">{selectedOrder.customer}</p>
                  <p className="text-[#6B6259]">{selectedOrder.email}</p>
                </div>
                <div>
                  <p className="text-[#6B6259]">Dirección</p>
                  <p className="font-semibold text-[#2A2521]">{selectedOrder.address}</p>
                </div>
                <div>
                  <p className="text-[#6B6259]">Pago</p>
                  <p className="font-semibold text-[#2A2521]">{selectedOrder.paymentMethod === 'card' ? 'Tarjeta de crédito/débito' : 'Transferencia bancaria'}</p>
                </div>
              </div>

              <div className="border-t border-[#E6DBC9] pt-3 mb-4">
                <p className="text-xs text-[#6B6259] mb-2">Productos</p>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#2A2521] flex-1 truncate mr-2">{item.productName} ×{item.quantity}</span>
                    <span className="font-semibold text-[#2A2521] flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-[#E6DBC9]">
                  <span>Total</span>
                  <span className="text-[#3E5C4B]">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Transfer comprobante actions */}
              {selectedOrder.paymentMethod === 'transfer' && selectedOrder.status === 'pendiente' && (
                <div className="mb-4 p-3 bg-[#F9F1E6] rounded-lg">
                  {selectedOrder.hasComprobante ? (
                    <>
                      <p className="text-xs font-semibold text-[#2A2521] mb-2">Comprobante recibido</p>
                      <button className="w-full text-xs text-[#3E5C4B] font-semibold border border-[#E6DBC9] bg-white py-2 rounded-lg hover:bg-[#EDF3EF] transition-colors mb-2">
                        Ver comprobante
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(selectedOrder.id, 'pagado')}
                          className="flex-1 text-xs bg-[#3E5C4B] text-white py-2 rounded-lg font-semibold hover:bg-[#2e4437] transition-colors"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => updateStatus(selectedOrder.id, 'cancelado')}
                          className="flex-1 text-xs bg-[#F8EDE8] text-[#B8623F] py-2 rounded-lg font-semibold hover:bg-[#B8623F] hover:text-white transition-colors"
                        >
                          ✗ Rechazar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[#B8623F] font-semibold">⏳ Esperando comprobante</p>
                  )}
                </div>
              )}

              {/* Status update */}
              <div>
                <p className="text-xs text-[#6B6259] mb-2 font-semibold">Cambiar estado</p>
                <select
                  value={selectedOrder.status}
                  onChange={e => updateStatus(selectedOrder.id, e.target.value as Order['status'])}
                  className="w-full px-3 py-2 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] cursor-pointer bg-white"
                >
                  {allStatuses.map(s => (
                    <option key={s} value={s}>{statusConfig[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
