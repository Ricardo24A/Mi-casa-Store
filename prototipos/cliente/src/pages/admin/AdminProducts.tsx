import { useState } from 'react';
import { Link } from 'react-router';
import { products as initialProducts, categories, formatPrice } from '../../data';
import type { Product } from '../../data';

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productList, setProductList] = useState<Product[]>(initialProducts);

  const filtered = productList.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const toggleActive = (id: string) => {
    setProductList(list => list.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const catName = (id: string) => categories.find(c => c.id === id)?.name || id;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#2A2521]">Productos</h1>
          <p className="text-sm text-[#6B6259] mt-0.5">{productList.length} productos en total</p>
        </div>
        <Link
          to="/admin/productos/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#3E5C4B] text-white text-sm font-semibold rounded-lg hover:bg-[#2e4437] transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
          </svg>
          Nuevo producto
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-52">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6259]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-[#E6DBC9] bg-white px-3 py-2.5 rounded-lg text-[#2A2521] focus:outline-none focus:border-[#3E5C4B] cursor-pointer"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E6DBC9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6DBC9]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap">Producto</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap hidden md:table-cell">Categoría</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap">Precio</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap hidden sm:table-cell">Stock</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap">Estado</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-[#6B6259] whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DBC9]">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-[#F9F1E6] transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F9F1E6] flex-shrink-0">
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#2A2521] truncate max-w-[160px]">{product.name}</p>
                        <p className="text-xs text-[#6B6259]">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <p className="text-[#6B6259] text-xs">{catName(product.category)}</p>
                    <p className="text-xs text-[#6B6259]/60">{product.subcategory}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-[#2A2521]">{formatPrice(product.price)}</p>
                    {product.originalPrice && (
                      <p className="text-xs text-[#6B6259] line-through">{formatPrice(product.originalPrice)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      product.stock > 10 ? 'bg-[#EDF3EF] text-[#3E5C4B]' :
                      product.stock > 0 ? 'bg-[#F8EDE8] text-[#B8623F]' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {product.stock} ud.
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => toggleActive(product.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${product.active ? 'bg-[#3E5C4B]' : 'bg-[#E6DBC9]'}`}
                      title={product.active ? 'Desactivar' : 'Activar'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${product.active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <p className="text-xs text-[#6B6259] mt-0.5">{product.active ? 'Activo' : 'Inactivo'}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/producto/${product.id}`} target="_blank" className="p-1.5 text-[#6B6259] hover:text-[#3E5C4B] transition-colors" title="Ver en tienda">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                      <button className="p-1.5 text-[#6B6259] hover:text-[#2A2521] transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#6B6259] text-sm">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
