import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCart } from '../store/CartContext';
import { categories } from '../data';

const categoryMeta: Record<string, { emoji: string }> = {
  electrodomesticos: { emoji: '🔌' },
  tecnologia: { emoji: '📱' },
  bano: { emoji: '🚿' },
  dormitorio: { emoji: '🛏' },
  comedor: { emoji: '🍽' },
  cocina: { emoji: '🍳' },
  exteriores: { emoji: '🌿' },
  decoracion: { emoji: '🕯' },
};

export default function Header() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/catalogo?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  const handleCategoryEnter = (id: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setActiveDropdown(id);
  };

  const handleCategoryLeave = () => {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 120);
  };

  return (
    <header className="bg-white border-b border-[#E6DBC9] sticky top-0 z-40">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-4">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 -ml-2 text-[#6B6259] hover:text-[#2A2521] transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </button>

          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2">
            <span className="text-xl font-semibold text-[#3E5C4B] tracking-tight">Mi casa Store</span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-4 pr-10 py-2 text-sm bg-[#F9F1E6] border border-[#E6DBC9] rounded-lg text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B] focus:ring-1 focus:ring-[#3E5C4B] transition-colors"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6259] hover:text-[#3E5C4B] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Account */}
            <Link to="/cuenta" className="p-2 text-[#6B6259] hover:text-[#3E5C4B] transition-colors" aria-label="Mi cuenta">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
              </svg>
            </Link>

            {/* Cart */}
            <Link to="/carrito" className="relative p-2 text-[#6B6259] hover:text-[#3E5C4B] transition-colors" aria-label="Carrito">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#3E5C4B] text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Category nav - desktop */}
      <nav className="hidden lg:block border-t border-[#E6DBC9] bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <ul className="flex items-center gap-0">
            {categories.map(cat => (
              <li
                key={cat.id}
                className="relative"
                onMouseEnter={() => handleCategoryEnter(cat.id)}
                onMouseLeave={handleCategoryLeave}
              >
                <Link
                  to={`/categoria/${cat.id}`}
                  className={`flex items-center gap-1 px-3 py-3 text-sm transition-colors border-b-2 whitespace-nowrap ${
                    activeDropdown === cat.id
                      ? 'text-[#3E5C4B] border-[#3E5C4B]'
                      : 'text-[#6B6259] border-transparent hover:text-[#2A2521]'
                  }`}
                >
                  {cat.name}
                  <svg className="w-3 h-3 mt-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </Link>

                {/* Dropdown */}
                {activeDropdown === cat.id && (
                  <div
                    className="absolute top-full left-0 bg-white border border-[#E6DBC9] rounded-lg shadow-sm min-w-[200px] py-2 z-50"
                    onMouseEnter={() => handleCategoryEnter(cat.id)}
                    onMouseLeave={handleCategoryLeave}
                  >
                    {cat.subcategories.map(sub => (
                      <Link
                        key={sub}
                        to={`/categoria/${cat.id}?sub=${encodeURIComponent(sub)}`}
                        className="block px-4 py-2 text-sm text-[#6B6259] hover:text-[#3E5C4B] hover:bg-[#EDF3EF] transition-colors"
                      >
                        {sub}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#2A2521]/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#E6DBC9]">
              <span className="text-lg font-semibold text-[#3E5C4B]">Nido Hogar</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 text-[#6B6259]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile search */}
            <div className="px-5 py-4 border-b border-[#E6DBC9]">
              <form onSubmit={e => { handleSearch(e); setMobileOpen(false); }}>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar productos..."
                    className="w-full pl-4 pr-10 py-2.5 text-sm bg-[#F9F1E6] border border-[#E6DBC9] rounded-lg text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6259]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {categories.map(cat => (
                <div key={cat.id}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3 text-sm text-[#2A2521] hover:bg-[#F9F1E6] transition-colors"
                    onClick={() => setMobileExpanded(mobileExpanded === cat.id ? null : cat.id)}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{categoryMeta[cat.id]?.emoji}</span>
                      <span className="font-semibold">{cat.name}</span>
                    </span>
                    <svg
                      className={`w-4 h-4 text-[#6B6259] transition-transform ${mobileExpanded === cat.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {mobileExpanded === cat.id && (
                    <div className="bg-[#F9F1E6] border-y border-[#E6DBC9]">
                      <Link
                        to={`/categoria/${cat.id}`}
                        className="block px-12 py-2.5 text-sm text-[#3E5C4B] font-semibold hover:bg-[#EDF3EF] transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        Ver todo en {cat.name}
                      </Link>
                      {cat.subcategories.map(sub => (
                        <Link
                          key={sub}
                          to={`/categoria/${cat.id}?sub=${encodeURIComponent(sub)}`}
                          className="block px-12 py-2.5 text-sm text-[#6B6259] hover:text-[#3E5C4B] hover:bg-[#EDF3EF] transition-colors"
                          onClick={() => setMobileOpen(false)}
                        >
                          {sub}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="px-5 py-4 border-t border-[#E6DBC9] flex gap-4">
              <Link to="/cuenta" className="flex items-center gap-2 text-sm text-[#6B6259]" onClick={() => setMobileOpen(false)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
                </svg>
                Mi cuenta
              </Link>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
