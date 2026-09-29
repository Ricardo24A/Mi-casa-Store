import { useState } from 'react';
import { sampleDiscounts, categories } from '../../data';
import type { Discount } from '../../data';

const typeLabel = { percent: 'Porcentaje', fixed: 'Monto fijo' };
const appliesToLabel = { product: 'Producto', category: 'Categoría', store: 'Toda la tienda' };

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>(sampleDiscounts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    appliesTo: 'store' as 'product' | 'category' | 'store',
    targetId: '',
    startDate: '',
    endDate: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newDiscount: Discount = {
      id: `d${Date.now()}`,
      code: form.code || undefined,
      type: form.type,
      value: Number(form.value),
      appliesTo: form.appliesTo,
      targetId: form.targetId || undefined,
      targetName: form.appliesTo === 'category' ? categories.find(c => c.id === form.targetId)?.name : undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      active: true,
    };
    setDiscounts(d => [newDiscount, ...d]);
    setShowForm(false);
    setForm({ code: '', type: 'percent', value: '', appliesTo: 'store', targetId: '', startDate: '', endDate: '' });
  };

  const toggleDiscount = (id: string) => {
    setDiscounts(d => d.map(x => x.id === id ? { ...x, active: !x.active } : x));
  };

  const deleteDiscount = (id: string) => {
    setDiscounts(d => d.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#2A2521]">Descuentos</h1>
          <p className="text-sm text-[#6B6259] mt-0.5">{discounts.length} descuentos configurados</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#3E5C4B] text-white text-sm font-semibold rounded-lg hover:bg-[#2e4437] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
          </svg>
          Nuevo descuento
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 mb-6">
          <h2 className="font-semibold text-[#2A2521] mb-5">Crear descuento</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Código de cupón (opcional)</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="VERANO20"
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] uppercase placeholder-[#6B6259]"
                />
                <p className="text-xs text-[#6B6259] mt-1">Dejar vacío para aplicar automáticamente</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Tipo de descuento</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percent' | 'fixed' }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] cursor-pointer bg-white"
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">
                  Valor {form.type === 'percent' ? '(%)' : '(USD)'} <span className="text-[#B8623F]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6259]">
                    {form.type === 'percent' ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    min={0}
                    max={form.type === 'percent' ? 100 : undefined}
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Aplicar a</label>
                <select
                  value={form.appliesTo}
                  onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value as typeof form.appliesTo, targetId: '' }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] cursor-pointer bg-white"
                >
                  <option value="store">Toda la tienda</option>
                  <option value="category">Una categoría</option>
                  <option value="product">Un producto</option>
                </select>
              </div>
            </div>

            {form.appliesTo === 'category' && (
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Categoría <span className="text-[#B8623F]">*</span></label>
                <select
                  value={form.targetId}
                  onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] cursor-pointer bg-white"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Fecha de inicio <span className="text-[#B8623F]">*</span></label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Fecha de fin <span className="text-[#B8623F]">*</span></label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 bg-[#3E5C4B] text-white text-sm font-semibold rounded-lg hover:bg-[#2e4437] transition-colors">
                Crear descuento
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-[#E6DBC9] text-[#2A2521] text-sm font-semibold rounded-lg hover:bg-[#F9F1E6] transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Discount list */}
      <div className="space-y-3">
        {discounts.map(discount => (
          <div key={discount.id} className={`bg-white rounded-xl border transition-colors ${discount.active ? 'border-[#E6DBC9]' : 'border-[#E6DBC9] opacity-60'}`}>
            <div className="p-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {discount.code && (
                    <span className="text-sm font-semibold bg-[#F9F1E6] border border-[#E6DBC9] text-[#2A2521] px-2.5 py-0.5 rounded-full font-mono tracking-wide">
                      {discount.code}
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${discount.active ? 'bg-[#EDF3EF] text-[#3E5C4B]' : 'bg-[#F9F1E6] text-[#6B6259]'}`}>
                    {discount.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B6259]">
                  <span className="font-semibold text-[#B8623F]">
                    {discount.type === 'percent' ? `-${discount.value}%` : `-$${discount.value}`}
                  </span>
                  <span>·</span>
                  <span>{appliesToLabel[discount.appliesTo]}{discount.targetName ? `: ${discount.targetName}` : ''}</span>
                  <span>·</span>
                  <span>{discount.startDate} → {discount.endDate}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleDiscount(discount.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${discount.active ? 'bg-[#3E5C4B]' : 'bg-[#E6DBC9]'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${discount.active ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <button
                  onClick={() => deleteDiscount(discount.id)}
                  className="p-1.5 text-[#6B6259] hover:text-[#B8623F] transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        {discounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E6DBC9]">
            <p className="text-[#6B6259] text-sm">No hay descuentos configurados</p>
          </div>
        )}
      </div>
    </div>
  );
}
