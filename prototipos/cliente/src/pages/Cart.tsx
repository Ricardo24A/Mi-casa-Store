import { Link, useNavigate } from 'react-router';
import { useCart } from '../store/CartContext';
import { formatPrice } from '../data';

export default function Cart() {
  const { items, total, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  const shipping = total >= 50 ? 0 : 8.99;
  const finalTotal = total + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#EDF3EF] mb-6">
          <svg className="w-10 h-10 text-[#3E5C4B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[#2A2521] mb-2">Tu carrito está vacío</h2>
        <p className="text-sm text-[#6B6259] mb-8">Agrega productos para comenzar tu compra.</p>
        <Link to="/catalogo" className="inline-flex items-center gap-2 bg-[#3E5C4B] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#2e4437] transition-colors">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold text-[#2A2521] mb-8">Tu carrito ({items.length})</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="bg-white rounded-xl border border-[#E6DBC9] p-4 flex gap-4">
              <Link to={`/producto/${product.id}`} className="flex-shrink-0">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#F9F1E6] border border-[#E6DBC9]">
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <Link to={`/producto/${product.id}`} className="text-sm font-semibold text-[#2A2521] hover:text-[#3E5C4B] transition-colors line-clamp-2 block mb-1">
                  {product.name}
                </Link>
                <p className="text-xs text-[#6B6259] mb-3">{product.subcategory}</p>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center border border-[#E6DBC9] rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-[#6B6259] hover:bg-[#F9F1E6] transition-colors text-sm"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-[#2A2521]">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      disabled={quantity >= product.stock}
                      className="w-8 h-8 flex items-center justify-center text-[#6B6259] hover:bg-[#F9F1E6] transition-colors text-sm disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-[#3E5C4B] text-sm">{formatPrice(product.price * quantity)}</span>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-[#6B6259] hover:text-[#B8623F] transition-colors p-1"
                      aria-label="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Link to="/catalogo" className="flex items-center gap-2 text-sm text-[#3E5C4B] font-semibold hover:underline pt-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Seguir comprando
          </Link>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 sticky top-24">
            <h2 className="font-semibold text-[#2A2521] mb-5">Resumen del pedido</h2>

            <div className="space-y-3 text-sm mb-5">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between gap-2">
                  <span className="text-[#6B6259] truncate flex-1">{product.name} ×{quantity}</span>
                  <span className="text-[#2A2521] font-semibold flex-shrink-0">{formatPrice(product.price * quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-[#E6DBC9] pt-4 mb-5">
              <div className="flex justify-between">
                <span className="text-[#6B6259]">Subtotal</span>
                <span className="text-[#2A2521]">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6259]">Envío</span>
                <span className={shipping === 0 ? 'text-[#3E5C4B] font-semibold' : 'text-[#2A2521]'}>
                  {shipping === 0 ? 'Gratis' : formatPrice(shipping)}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-[#6B6259]">Agrega {formatPrice(50 - total)} más para envío gratis</p>
              )}
            </div>

            <div className="flex justify-between font-semibold text-base border-t border-[#E6DBC9] pt-4 mb-6">
              <span className="text-[#2A2521]">Total</span>
              <span className="text-[#3E5C4B]">{formatPrice(finalTotal)}</span>
            </div>

            {/* Coupon */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                placeholder="Código de descuento"
                className="flex-1 px-3 py-2 text-xs border border-[#E6DBC9] rounded-lg bg-[#F9F1E6] text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
              />
              <button className="px-3 py-2 text-xs font-semibold border border-[#E6DBC9] rounded-lg text-[#2A2521] hover:bg-[#F9F1E6] transition-colors whitespace-nowrap">
                Aplicar
              </button>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full py-3 bg-[#3E5C4B] text-white font-semibold text-sm rounded-lg hover:bg-[#2e4437] transition-colors"
            >
              Ir al checkout
            </button>

            <div className="mt-4 flex justify-center gap-3">
              {['💳', '🏦', '🔒'].map(icon => (
                <span key={icon} className="text-lg">{icon}</span>
              ))}
            </div>
            <p className="text-center text-xs text-[#6B6259] mt-1">Pago seguro y protegido</p>
          </div>
        </div>
      </div>
    </div>
  );
}
