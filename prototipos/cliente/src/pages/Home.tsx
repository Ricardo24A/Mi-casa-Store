import { Link } from 'react-router';
import { products, categories, formatPrice, getDiscount } from '../data';
import { useCart } from '../store/CartContext';

const featuredCategories = categories.slice(0, 6);
const offerProducts = products.filter(p => p.originalPrice).slice(0, 4);
const featuredProducts = products.filter(p => p.featured).slice(0, 4);

function ProductCard({ product }: { product: typeof products[0] }) {
  const { addItem } = useCart();
  const discount = getDiscount(product);

  return (
    <Link to={`/producto/${product.id}`} className="group bg-white rounded-xl border border-[#E6DBC9] overflow-hidden hover:border-[#3E5C4B]/40 transition-colors">
      <div className="aspect-square bg-[#F9F1E6] overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <p className="text-xs text-[#6B6259] mb-1 capitalize">{product.subcategory}</p>
        <p className="text-sm font-semibold text-[#2A2521] leading-snug mb-2 line-clamp-2 group-hover:text-[#3E5C4B] transition-colors">{product.name}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-semibold text-[#3E5C4B]">{formatPrice(product.price)}</span>
            {product.originalPrice && (
              <span className="ml-2 text-xs text-[#6B6259] line-through">{formatPrice(product.originalPrice)}</span>
            )}
          </div>
          {discount && (
            <span className="text-xs font-semibold bg-[#F8EDE8] text-[#B8623F] px-2 py-0.5 rounded-full">-{discount}%</span>
          )}
        </div>
        <button
          onClick={e => { e.preventDefault(); addItem(product); }}
          className="mt-3 w-full py-2 text-xs font-semibold bg-[#3E5C4B] text-white rounded-lg hover:bg-[#2e4437] transition-colors"
        >
          Agregar al carrito
        </button>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-white border-b border-[#E6DBC9]">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-[#3E5C4B] mb-4 tracking-wide uppercase">Bienvenido a Mi casa Store</p>
            <h1 className="text-4xl lg:text-5xl font-semibold text-[#2A2521] leading-tight mb-5">
              Todo lo que tu<br />
              hogar necesita
            </h1>
            <p className="text-[#6B6259] text-lg mb-8 leading-relaxed max-w-md">
              Productos de calidad para cada rincón de tu casa, seleccionados con cuidado para hacer tu vida más cómoda.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/catalogo"
                className="inline-flex items-center gap-2 bg-[#3E5C4B] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#2e4437] transition-colors"
              >
                Ver productos
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/categoria/decoracion"
                className="inline-flex items-center gap-2 border border-[#E6DBC9] text-[#2A2521] px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#F9F1E6] transition-colors"
              >
                Ver ofertas
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-8">
              {[['4.8★', 'Valoración media'], ['12K+', 'Clientes felices'], ['100%', 'Garantía calidad']].map(([val, label]) => (
                <div key={label}>
                  <p className="font-semibold text-[#2A2521]">{val}</p>
                  <p className="text-xs text-[#6B6259]">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-2 gap-3">
            {featuredProducts.slice(0, 4).map((p, i) => (
              <Link key={p.id} to={`/producto/${p.id}`} className={`group rounded-xl overflow-hidden bg-[#F9F1E6] border border-[#E6DBC9] ${i === 0 ? 'row-span-2' : ''}`}>
                <div className={`w-full bg-[#F9F1E6] overflow-hidden ${i === 0 ? 'h-full' : 'aspect-square'}`}>
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categorías destacadas */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-semibold text-[#2A2521]">Categorías</h2>
          <Link to="/catalogo" className="text-sm text-[#3E5C4B] hover:underline font-semibold">Ver todas</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {featuredCategories.map(cat => (
            <Link
              key={cat.id}
              to={`/categoria/${cat.id}`}
              className="group flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-[#E6DBC9] hover:border-[#3E5C4B]/40 hover:bg-[#F9F1E6] transition-all"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F9F1E6]">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-xs font-semibold text-[#2A2521] text-center leading-tight group-hover:text-[#3E5C4B] transition-colors">{cat.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Productos destacados */}
      <section className="max-w-7xl mx-auto px-6 py-6 pb-14">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-semibold text-[#2A2521]">Más populares</h2>
          <Link to="/catalogo" className="text-sm text-[#3E5C4B] hover:underline font-semibold">Ver todos</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featuredProducts.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Banner intermedio */}
      <section className="bg-[#3E5C4B] text-white py-14">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold mb-2 opacity-80">Envío a todo el país</p>
          <h2 className="text-3xl font-semibold mb-4">Compra con confianza</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-8">Garantía de satisfacción en todos los productos. Si no quedas contento, te devolvemos el dinero.</p>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              ['🚚', 'Envío gratis', 'En compras mayores a $50'],
              ['↩️', 'Devoluciones', '30 días sin preguntas'],
              ['🔒', 'Pago seguro', 'Tus datos siempre protegidos'],
              ['⭐', 'Garantía', '12 meses en todos los productos'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="text-center">
                <p className="text-2xl mb-1">{icon}</p>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-white/60 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ofertas */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-[#2A2521]">Ofertas especiales</h2>
            <p className="text-sm text-[#6B6259] mt-1">Precios especiales por tiempo limitado</p>
          </div>
          <Link to="/catalogo" className="text-sm text-[#B8623F] font-semibold hover:underline">Ver todas las ofertas</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {offerProducts.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-white border-t border-[#E6DBC9] py-14">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-[#2A2521] mb-2">Descuentos exclusivos</h2>
          <p className="text-[#6B6259] mb-6">Suscríbete y recibe un 10% de descuento en tu primera compra.</p>
          <form className="flex gap-2 max-w-sm mx-auto" onSubmit={e => e.preventDefault()}>
            <input
              type="email"
              placeholder="tu@email.com"
              className="flex-1 px-4 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-[#F9F1E6] text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
            />
            <button type="submit" className="px-4 py-2.5 bg-[#3E5C4B] text-white text-sm font-semibold rounded-lg hover:bg-[#2e4437] transition-colors whitespace-nowrap">
              Suscribirme
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
