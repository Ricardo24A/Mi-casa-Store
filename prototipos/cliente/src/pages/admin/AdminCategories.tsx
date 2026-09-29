import { categories } from '../../data';

export default function AdminCategories() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#2A2521]">Categorías</h1>
        <p className="text-sm text-[#6B6259] mt-0.5">{categories.length} categorías configuradas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl border border-[#E6DBC9] overflow-hidden">
            <div className="h-28 bg-[#F9F1E6] overflow-hidden">
              <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <p className="font-semibold text-[#2A2521] mb-2">{cat.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.subcategories.map(sub => (
                  <span key={sub} className="text-xs bg-[#F9F1E6] border border-[#E6DBC9] text-[#6B6259] px-2 py-0.5 rounded-full">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
