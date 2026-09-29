import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { products, categories, formatPrice, getDiscount } from '../data';
import { useCart } from '../store/CartContext';

export default function Product() {
  const { productId } = useParams();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const product = products.find(p => p.id === productId);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <p className="text-4xl mb-4">😕</p>
        <p className="font-semibold text-[#2A2521] mb-2">Producto no encontrado</p>
        <Link to="/catalogo" className="text-sm text-[#3E5C4B] font-semibold hover:underline">Volver al catálogo</Link>
      </div>
    );
  }

  const category = categories.find(c => c.id === product.category);
  const discount = getDiscount(product);
  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product, qty);
    navigate('/carrito');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#6B6259] mb-8">
        <Link to="/" className="hover:text-[#3E5C4B]">Inicio</Link>
        <span>/</span>
        {category && <Link to={`/categoria/${category.id}`} className="hover:text-[#3E5C4B]">{category.name}</Link>}
        <span>/</span>
        <span className="text-[#2A2521] truncate max-w-[200px]">{product.name}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-[#F9F1E6] rounded-xl overflow-hidden mb-3 border border-[#E6DBC9]">
            <img
              src={product.images[activeImg] || product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${
                    activeImg === i ? 'border-[#3E5C4B]' : 'border-[#E6DBC9] hover:border-[#6B6259]'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start gap-3 mb-2">
            {category && (
              <Link to={`/categoria/${product.category}`} className="text-xs font-semibold text-[#3E5C4B] bg-[#EDF3EF] px-2.5 py-1 rounded-full hover:bg-[#D1E4D9] transition-colors">
                {category.name}
              </Link>
            )}
            <span className="text-xs text-[#6B6259] bg-[#F9F1E6] px-2.5 py-1 rounded-full border border-[#E6DBC9]">{product.subcategory}</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-semibold text-[#2A2521] leading-tight mb-4">{product.name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-semibold text-[#3E5C4B]">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <>
                <span className="text-lg text-[#6B6259] line-through">{formatPrice(product.originalPrice)}</span>
                <span className="text-sm font-semibold bg-[#F8EDE8] text-[#B8623F] px-2.5 py-1 rounded-full">-{discount}% OFF</span>
              </>
            )}
          </div>

          {product.originalPrice && (
            <p className="text-sm text-[#B8623F] font-semibold mb-4">
              Ahorras {formatPrice(product.originalPrice - product.price)} con esta oferta
            </p>
          )}

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`w-2 h-2 rounded-full ${product.stock > 5 ? 'bg-[#3E5C4B]' : product.stock > 0 ? 'bg-[#B8623F]' : 'bg-red-500'}`} />
            <span className="text-sm text-[#6B6259]">
              {product.stock > 10
                ? 'En stock — envío inmediato'
                : product.stock > 0
                ? `Solo quedan ${product.stock} unidades`
                : 'Sin stock'}
            </span>
          </div>

          {/* SKU */}
          <p className="text-xs text-[#6B6259] mb-6">SKU: {product.sku}</p>

          {/* Description */}
          <p className="text-sm text-[#6B6259] leading-relaxed mb-8 border-t border-[#E6DBC9] pt-6">{product.description}</p>

          {/* Quantity */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-semibold text-[#2A2521]">Cantidad</span>
            <div className="flex items-center border border-[#E6DBC9] rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 flex items-center justify-center text-[#6B6259] hover:bg-[#F9F1E6] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <span className="w-10 text-center text-sm font-semibold text-[#2A2521]">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                className="w-9 h-9 flex items-center justify-center text-[#6B6259] hover:bg-[#F9F1E6] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
                added
                  ? 'bg-[#EDF3EF] text-[#3E5C4B] border border-[#3E5C4B]'
                  : product.stock === 0
                  ? 'bg-[#E6DBC9] text-[#6B6259] cursor-not-allowed'
                  : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'
              }`}
            >
              {added ? '✓ Agregado al carrito' : product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="flex-1 py-3 text-sm font-semibold rounded-lg border-2 border-[#3E5C4B] text-[#3E5C4B] hover:bg-[#EDF3EF] transition-colors"
            >
              Comprar ahora
            </button>
          </div>

          {/* Trust signals */}
          <div className="mt-6 pt-6 border-t border-[#E6DBC9] flex flex-col gap-2">
            {[
              ['🚚', 'Envío gratis en compras mayores a $50'],
              ['↩️', 'Devolución gratuita en 30 días'],
              ['🔒', 'Pago 100% seguro'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2 text-xs text-[#6B6259]">
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-[#2A2521] mb-6">También te puede interesar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map(p => (
              <Link key={p.id} to={`/producto/${p.id}`} className="group bg-white rounded-xl border border-[#E6DBC9] overflow-hidden hover:border-[#3E5C4B]/40 transition-colors">
                <div className="aspect-square bg-[#F9F1E6] overflow-hidden">
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-[#2A2521] line-clamp-2 mb-1 group-hover:text-[#3E5C4B] transition-colors">{p.name}</p>
                  <p className="text-sm font-semibold text-[#3E5C4B]">{formatPrice(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
