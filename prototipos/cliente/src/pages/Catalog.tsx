import { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { products, categories, formatPrice, getDiscount } from '../data';
import { useCart } from '../store/CartContext';

const sortOptions = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name-asc', label: 'Nombre A-Z' },
];

function ProductCard({ product }: { product: typeof products[0] }) {
  const { addItem } = useCart();
  const discount = getDiscount(product);
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link to={`/producto/${product.id}`} className="group bg-white rounded-xl border border-[#E6DBC9] overflow-hidden hover:border-[#3E5C4B]/40 transition-colors">
      <div className="aspect-square bg-[#F9F1E6] overflow-hidden relative">
        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {discount && (
          <span className="absolute top-3 left-3 text-xs font-semibold bg-[#B8623F] text-white px-2 py-0.5 rounded-full">-{discount}%</span>
        )}
        {product.stock <= 5 && product.stock > 0 && (
          <span className="absolute top-3 right-3 text-xs font-semibold bg-[#F8EDE8] text-[#B8623F] px-2 py-0.5 rounded-full">Últimas {product.stock}</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-[#6B6259] mb-1">{product.subcategory}</p>
        <p className="text-sm font-semibold text-[#2A2521] leading-snug mb-2 line-clamp-2 group-hover:text-[#3E5C4B] transition-colors">{product.name}</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base font-semibold text-[#3E5C4B]">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-xs text-[#6B6259] line-through">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
        <button
          onClick={handleAdd}
          className={`w-full py-2 text-xs font-semibold rounded-lg transition-all ${
            added
              ? 'bg-[#EDF3EF] text-[#3E5C4B]'
              : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'
          }`}
        >
          {added ? '✓ Agregado' : 'Agregar al carrito'}
        </button>
      </div>
    </Link>
  );
}

export default function Catalog() {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const subFromUrl = searchParams.get('sub') || '';

  const category = categoryId ? categories.find(c => c.id === categoryId) : null;

  const [selectedSub, setSelectedSub] = useState(subFromUrl);
  const [priceRange, setPriceRange] = useState([0, 120]);
  const [sort, setSort] = useState('relevance');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = products.filter(p => p.active);

    if (categoryId) list = list.filter(p => p.category === categoryId);
    if (selectedSub) list = list.filter(p => p.subcategory === selectedSub);
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase()));
    list = list.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    switch (sort) {
      case 'price-asc': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'price-desc': list = [...list].sort((a, b) => b.price - a.price); break;
      case 'name-asc': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
    }

    return list;
  }, [categoryId, selectedSub, q, priceRange, sort]);

  const title = q ? `Resultados para "${q}"` : category?.name || 'Todos los productos';

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <p className="text-sm font-semibold text-[#2A2521] mb-3">Categorías</p>
        <div className="space-y-1">
          <Link
            to="/catalogo"
            className={`block text-sm py-1.5 px-2 rounded-lg transition-colors ${!categoryId ? 'text-[#3E5C4B] font-semibold bg-[#EDF3EF]' : 'text-[#6B6259] hover:text-[#2A2521] hover:bg-[#F9F1E6]'}`}
          >
            Todos los productos
          </Link>
          {categories.map(cat => (
            <Link
              key={cat.id}
              to={`/categoria/${cat.id}`}
              className={`block text-sm py-1.5 px-2 rounded-lg transition-colors ${categoryId === cat.id ? 'text-[#3E5C4B] font-semibold bg-[#EDF3EF]' : 'text-[#6B6259] hover:text-[#2A2521] hover:bg-[#F9F1E6]'}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Subcategory filter */}
      {category && (
        <div>
          <p className="text-sm font-semibold text-[#2A2521] mb-3">Subcategoría</p>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedSub('')}
              className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${!selectedSub ? 'text-[#3E5C4B] font-semibold bg-[#EDF3EF]' : 'text-[#6B6259] hover:text-[#2A2521] hover:bg-[#F9F1E6]'}`}
            >
              Todas
            </button>
            {category.subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSub(sub)}
                className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${selectedSub === sub ? 'text-[#3E5C4B] font-semibold bg-[#EDF3EF]' : 'text-[#6B6259] hover:text-[#2A2521] hover:bg-[#F9F1E6]'}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price range */}
      <div>
        <p className="text-sm font-semibold text-[#2A2521] mb-3">Precio</p>
        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={120}
            value={priceRange[1]}
            onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full accent-[#3E5C4B]"
          />
          <div className="flex justify-between text-xs text-[#6B6259]">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Only offers */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#3E5C4B] w-4 h-4"
            onChange={e => {
              if (e.target.checked) setPriceRange([0, 80]);
              else setPriceRange([0, 120]);
            }}
          />
          <span className="text-sm text-[#2A2521]">Solo con descuento</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#6B6259] mb-6">
        <Link to="/" className="hover:text-[#3E5C4B] transition-colors">Inicio</Link>
        <span>/</span>
        {category ? (
          <>
            <Link to="/catalogo" className="hover:text-[#3E5C4B] transition-colors">Catálogo</Link>
            <span>/</span>
            <span className="text-[#2A2521]">{category.name}</span>
          </>
        ) : (
          <span className="text-[#2A2521]">Catálogo</span>
        )}
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters - desktop */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <FilterPanel />
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-[#2A2521]">{title}</h1>
              <p className="text-sm text-[#6B6259] mt-0.5">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile filter button */}
              <button
                className="lg:hidden flex items-center gap-1.5 text-sm border border-[#E6DBC9] bg-white px-3 py-2 rounded-lg text-[#2A2521] hover:bg-[#F9F1E6] transition-colors"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M10 12h4" />
                </svg>
                Filtros
              </button>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-sm border border-[#E6DBC9] bg-white px-3 py-2 rounded-lg text-[#2A2521] focus:outline-none focus:border-[#3E5C4B] cursor-pointer"
              >
                {sortOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile filters */}
          {filtersOpen && (
            <div className="lg:hidden mb-6 bg-white border border-[#E6DBC9] rounded-xl p-5">
              <FilterPanel />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-semibold text-[#2A2521] mb-2">No encontramos productos</p>
              <p className="text-sm text-[#6B6259] mb-6">Intenta ajustar los filtros o busca otro término.</p>
              <Link to="/catalogo" className="text-sm text-[#3E5C4B] font-semibold hover:underline">Ver todos los productos</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
