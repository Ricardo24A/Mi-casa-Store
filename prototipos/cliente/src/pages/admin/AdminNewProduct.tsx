import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { categories, presetProductsBySubcategory } from '../../data';

type Step = 1 | 2 | 3 | 4;

interface ProductForm {
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  stock: string;
  sku: string;
  active: boolean;
  images: string[];
}

const emptyForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  originalPrice: '',
  stock: '',
  sku: '',
  active: true,
  images: [],
};

export default function AdminNewProduct() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCat = categories.find(c => c.id === selectedCategory);
  const subcategoryPresets = selectedCategory && selectedSubcategory
    ? presetProductsBySubcategory[selectedCategory]?.[selectedSubcategory] || []
    : [];

  const handlePresetSelect = (preset: typeof subcategoryPresets[0]) => {
    setForm({
      ...emptyForm,
      name: preset.name,
      description: preset.description,
      price: preset.suggestedPrice.toString(),
      sku: preset.sku + String(Math.floor(Math.random() * 900) + 100),
    });
    setStep(4);
  };

  const handleManualProduct = () => {
    setForm({ ...emptyForm, sku: `${selectedCategory.slice(0, 3).toUpperCase()}-MAN-${String(Date.now()).slice(-3)}` });
    setStep(4);
  };

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setImagePreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => navigate('/admin/productos'), 1200);
  };

  const stepLabels = ['Categoría', 'Subcategoría', 'Producto', 'Detalles'];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/productos" className="text-[#6B6259] hover:text-[#3E5C4B] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-[#2A2521]">Nuevo producto</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          const active = step === s;
          const done = step > s;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${active || done ? '' : 'opacity-40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  done ? 'bg-[#3E5C4B] text-white' : active ? 'bg-[#3E5C4B] text-white' : 'bg-[#E6DBC9] text-[#6B6259]'
                }`}>
                  {done ? '✓' : s}
                </div>
                <span className={`text-sm hidden sm:inline ${active ? 'font-semibold text-[#2A2521]' : 'text-[#6B6259]'}`}>{label}</span>
              </div>
              {i < 3 && <div className="w-6 lg:w-12 h-px bg-[#E6DBC9] flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Category */}
      {step === 1 && (
        <div>
          <p className="text-sm text-[#6B6259] mb-6">Selecciona la categoría principal del producto</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setStep(2); }}
                className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl border-2 border-[#E6DBC9] hover:border-[#3E5C4B] hover:bg-[#EDF3EF] transition-all text-center"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F9F1E6]">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-sm font-semibold text-[#2A2521] group-hover:text-[#3E5C4B] transition-colors">{cat.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Subcategory */}
      {step === 2 && selectedCat && (
        <div>
          <p className="text-sm text-[#6B6259] mb-1">Categoría: <span className="font-semibold text-[#2A2521]">{selectedCat.name}</span></p>
          <p className="text-sm text-[#6B6259] mb-6">Ahora elige la subcategoría</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedCat.subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => { setSelectedSubcategory(sub); setStep(3); }}
                className="group flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-[#E6DBC9] hover:border-[#3E5C4B] hover:bg-[#EDF3EF] transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-[#EDF3EF] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#3E5C4B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#2A2521] group-hover:text-[#3E5C4B] transition-colors text-left">{sub}</p>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="mt-6 text-sm text-[#6B6259] hover:text-[#3E5C4B] transition-colors flex items-center gap-1">
            ← Cambiar categoría
          </button>
        </div>
      )}

      {/* Step 3: Preset or manual */}
      {step === 3 && (
        <div>
          <p className="text-sm text-[#6B6259] mb-1">
            <span className="font-semibold text-[#2A2521]">{selectedCat?.name}</span> → <span className="font-semibold text-[#2A2521]">{selectedSubcategory}</span>
          </p>
          <p className="text-sm text-[#6B6259] mb-6">Selecciona un producto para rellenar el formulario automáticamente</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {subcategoryPresets.map(preset => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className="group flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-[#E6DBC9] hover:border-[#3E5C4B] hover:bg-[#EDF3EF] transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2A2521] group-hover:text-[#3E5C4B] transition-colors">{preset.name}</p>
                  <p className="text-xs text-[#6B6259] mt-0.5 line-clamp-2">{preset.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-[#3E5C4B]">${preset.suggestedPrice}</p>
                  <p className="text-xs text-[#6B6259]">sugerido</p>
                </div>
              </button>
            ))}
          </div>

          {/* Manual option - highlighted */}
          <button
            onClick={handleManualProduct}
            className="w-full flex items-center gap-4 p-4 bg-[#EDF3EF] rounded-xl border-2 border-[#3E5C4B] hover:bg-[#D1E4D9] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#3E5C4B] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#3E5C4B]">Otro producto (manual)</p>
              <p className="text-xs text-[#6B6259]">Ingresa todos los detalles del producto manualmente</p>
            </div>
          </button>

          <button onClick={() => setStep(2)} className="mt-6 text-sm text-[#6B6259] hover:text-[#3E5C4B] transition-colors flex items-center gap-1">
            ← Cambiar subcategoría
          </button>
        </div>
      )}

      {/* Step 4: Product form */}
      {step === 4 && (
        <form onSubmit={handleSave} className="max-w-2xl">
          <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 space-y-5 mb-5">
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Nombre del producto <span className="text-[#B8623F]">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Descripción <span className="text-[#B8623F]">*</span></label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Precio (USD) <span className="text-[#B8623F]">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6259]">$</span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    step="0.01"
                    min="0"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Precio original (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6259]">$</span>
                  <input
                    type="number"
                    value={form.originalPrice}
                    onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                    step="0.01"
                    min="0"
                    placeholder="Para mostrar descuento"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] placeholder-[#6B6259]"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Stock <span className="text-[#B8623F]">*</span></label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  min="0"
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">SKU</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                />
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Imágenes del producto</label>
              <div className="flex flex-wrap gap-3 mb-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E6DBC9] bg-[#F9F1E6] flex-shrink-0">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImagePreviews(p => p.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow text-[#6B6259] hover:text-[#B8623F] transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-[#E6DBC9] flex flex-col items-center justify-center gap-1 hover:border-[#3E5C4B] hover:bg-[#EDF3EF] transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 text-[#6B6259]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
                  </svg>
                  <span className="text-xs text-[#6B6259]">Subir</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleImages} />
              </div>
              <p className="text-xs text-[#6B6259]">JPG, PNG o WebP. La primera imagen será la principal.</p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E6DBC9]">
              <div>
                <p className="text-sm font-semibold text-[#2A2521]">Producto activo</p>
                <p className="text-xs text-[#6B6259]">Los productos activos se muestran en la tienda</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? 'bg-[#3E5C4B]' : 'bg-[#E6DBC9]'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saved}
              className={`px-6 py-3 font-semibold text-sm rounded-lg transition-all ${
                saved ? 'bg-[#EDF3EF] text-[#3E5C4B]' : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'
              }`}
            >
              {saved ? '✓ Producto guardado' : 'Guardar producto'}
            </button>
            <Link to="/admin/productos" className="px-6 py-3 border border-[#E6DBC9] text-[#2A2521] text-sm font-semibold rounded-lg hover:bg-[#F9F1E6] transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
