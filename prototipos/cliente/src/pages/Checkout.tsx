import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useCart } from '../store/CartContext';
import { formatPrice } from '../data';

type PaymentMethod = 'card' | 'transfer';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    department: '',
    zip: '',
    notes: '',
  });

  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [cardForm, setCardForm] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const shipping = total >= 50 ? 0 : 8.99;
  const transferDiscount = payment === 'transfer' ? total * 0.05 : 0;
  const finalTotal = total + shipping - transferDiscount;

  const update = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Requerido';
    if (!form.lastName.trim()) e.lastName = 'Requerido';
    if (!form.email.includes('@')) e.email = 'Email inválido';
    if (!form.phone.trim()) e.phone = 'Requerido';
    if (!form.address.trim()) e.address = 'Requerido';
    if (!form.city.trim()) e.city = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      clear();
      navigate('/confirmacion', {
        state: {
          orderNumber: `NID-${10046 + Math.floor(Math.random() * 100)}`,
          paymentMethod: payment,
          total: finalTotal,
          customerName: `${form.firstName} ${form.lastName}`,
        },
      });
    }, 1200);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <p className="font-semibold text-[#2A2521] mb-2">Tu carrito está vacío</p>
        <Link to="/catalogo" className="text-sm text-[#3E5C4B] font-semibold hover:underline">Ver productos</Link>
      </div>
    );
  }

  const Field = ({
    label, name, type = 'text', placeholder, half = false, required = true,
  }: {
    label: string; name: keyof typeof form; type?: string; placeholder?: string; half?: boolean; required?: boolean;
  }) => (
    <div className={half ? 'flex-1' : 'w-full'}>
      <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">
        {label}{required && <span className="text-[#B8623F] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={e => update(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:ring-1 transition-colors ${
          errors[name] ? 'border-[#B8623F] focus:ring-[#B8623F]/30' : 'border-[#E6DBC9] focus:border-[#3E5C4B] focus:ring-[#3E5C4B]/20'
        }`}
      />
      {errors[name] && <p className="text-xs text-[#B8623F] mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-xs text-[#6B6259] mb-8">
        <Link to="/carrito" className="hover:text-[#3E5C4B]">Carrito</Link>
        <span>/</span>
        <span className="text-[#2A2521]">Checkout</span>
      </div>

      <h1 className="text-2xl font-semibold text-[#2A2521] mb-8">Finalizar compra</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-xl border border-[#E6DBC9] p-6">
              <h2 className="font-semibold text-[#2A2521] mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#3E5C4B] text-white text-xs flex items-center justify-center font-semibold">1</span>
                Datos de contacto
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Field label="Nombre" name="firstName" placeholder="María" half />
                  <Field label="Apellido" name="lastName" placeholder="González" half />
                </div>
                <Field label="Correo electrónico" name="email" type="email" placeholder="maria@email.com" />
                <Field label="Teléfono" name="phone" type="tel" placeholder="+57 300 000 0000" />
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl border border-[#E6DBC9] p-6">
              <h2 className="font-semibold text-[#2A2521] mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#3E5C4B] text-white text-xs flex items-center justify-center font-semibold">2</span>
                Dirección de entrega
              </h2>
              <div className="space-y-4">
                <Field label="Dirección" name="address" placeholder="Calle 45 #12-34, Apto 201" />
                <div className="flex gap-3">
                  <Field label="Ciudad" name="city" placeholder="Bogotá" half />
                  <Field label="Departamento" name="department" placeholder="Cundinamarca" half />
                </div>
                <Field label="Código postal" name="zip" placeholder="110111" required={false} />
                <div>
                  <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Notas adicionales</label>
                  <textarea
                    value={form.notes}
                    onChange={e => update('notes', e.target.value)}
                    placeholder="Instrucciones especiales para la entrega..."
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl border border-[#E6DBC9] p-6">
              <h2 className="font-semibold text-[#2A2521] mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#3E5C4B] text-white text-xs flex items-center justify-center font-semibold">3</span>
                Método de pago
              </h2>

              <div className="space-y-3 mb-5">
                {([
                  { id: 'card', icon: '💳', title: 'Tarjeta de débito o crédito', desc: 'Visa, Mastercard, AmEx' },
                  { id: 'transfer', icon: '🏦', title: 'Transferencia bancaria', desc: '5% de descuento adicional' },
                ] as const).map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      payment === opt.id ? 'border-[#3E5C4B] bg-[#EDF3EF]' : 'border-[#E6DBC9] hover:border-[#6B6259]'
                    }`}
                  >
                    <input type="radio" name="payment" value={opt.id} checked={payment === opt.id} onChange={() => setPayment(opt.id)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payment === opt.id ? 'border-[#3E5C4B]' : 'border-[#E6DBC9]'}`}>
                      {payment === opt.id && <div className="w-2 h-2 rounded-full bg-[#3E5C4B]" />}
                    </div>
                    <span className="text-xl">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#2A2521]">{opt.title}</p>
                      <p className="text-xs text-[#6B6259]">{opt.desc}</p>
                    </div>
                    {opt.id === 'transfer' && (
                      <span className="ml-auto text-xs font-semibold bg-[#F8EDE8] text-[#B8623F] px-2 py-0.5 rounded-full">-5%</span>
                    )}
                  </label>
                ))}
              </div>

              {payment === 'card' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Número de tarjeta</label>
                    <input
                      type="text"
                      value={cardForm.number}
                      onChange={e => setCardForm(f => ({ ...f, number: e.target.value }))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Nombre en la tarjeta</label>
                    <input
                      type="text"
                      value={cardForm.name}
                      onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="MARÍA GONZÁLEZ"
                      className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B] uppercase"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Vencimiento</label>
                      <input
                        type="text"
                        value={cardForm.expiry}
                        onChange={e => setCardForm(f => ({ ...f, expiry: e.target.value }))}
                        placeholder="MM/AA"
                        maxLength={5}
                        className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">CVV</label>
                      <input
                        type="text"
                        value={cardForm.cvv}
                        onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value }))}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {payment === 'transfer' && (
                <div className="space-y-4">
                  <div className="bg-[#EDF3EF] border border-[#D1E4D9] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🎉</span>
                      <p className="text-sm font-semibold text-[#3E5C4B]">¡Obtén un 5% de descuento pagando por transferencia!</p>
                    </div>
                    <p className="text-xs text-[#6B6259]">Ahorra {formatPrice(transferDiscount)} en esta compra.</p>
                  </div>

                  <div className="bg-[#F9F1E6] border border-[#E6DBC9] rounded-lg p-4 space-y-2">
                    <p className="text-xs font-semibold text-[#2A2521] mb-3">Datos para la transferencia</p>
                    {[
                      ['Banco', 'Banco de Occidente'],
                      ['Tipo de cuenta', 'Cuenta de ahorros'],
                      ['Número de cuenta', '123-456789-01'],
                      ['Titular', 'Nido Hogar S.A.S.'],
                      ['NIT', '900.123.456-7'],
                      ['Referencia', 'Tu número de pedido (te llega por correo)'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-xs text-[#6B6259] w-32 flex-shrink-0">{k}:</span>
                        <span className="text-xs font-semibold text-[#2A2521]">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">
                      Subir comprobante de pago
                      <span className="ml-1 font-normal text-[#6B6259]">(opcional, puedes enviarlo después)</span>
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#E6DBC9] rounded-lg cursor-pointer hover:border-[#3E5C4B] hover:bg-[#EDF3EF] transition-colors">
                      <input type="file" className="sr-only" accept="image/*,.pdf" onChange={e => setComprobante(e.target.files?.[0] || null)} />
                      {comprobante ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[#3E5C4B]">✓ {comprobante.name}</p>
                          <p className="text-xs text-[#6B6259] mt-1">Haz clic para cambiar</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <svg className="w-6 h-6 text-[#6B6259] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-xs text-[#6B6259]">Haz clic para subir imagen o PDF</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: summary */}
          <div>
            <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 sticky top-24">
              <h2 className="font-semibold text-[#2A2521] mb-5">Resumen del pedido</h2>

              <div className="space-y-3 mb-5 max-h-48 overflow-y-auto">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F9F1E6] flex-shrink-0">
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#2A2521] truncate">{product.name}</p>
                      <p className="text-xs text-[#6B6259]">×{quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#2A2521] flex-shrink-0">{formatPrice(product.price * quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm border-t border-[#E6DBC9] pt-4 mb-4">
                <div className="flex justify-between">
                  <span className="text-[#6B6259]">Subtotal</span>
                  <span className="text-[#2A2521]">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6259]">Envío</span>
                  <span className={shipping === 0 ? 'text-[#3E5C4B] font-semibold' : ''}>{shipping === 0 ? 'Gratis' : formatPrice(shipping)}</span>
                </div>
                {transferDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#B8623F]">Descuento transferencia (5%)</span>
                    <span className="text-[#B8623F] font-semibold">-{formatPrice(transferDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-semibold text-base border-t border-[#E6DBC9] pt-4 mb-6">
                <span className="text-[#2A2521]">Total</span>
                <span className="text-[#3E5C4B]">{formatPrice(finalTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 font-semibold text-sm rounded-lg transition-all ${
                  submitting
                    ? 'bg-[#6B6259] text-white cursor-not-allowed'
                    : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'
                }`}
                onClick={handleSubmit}
              >
                {submitting ? 'Procesando...' : 'Confirmar pedido'}
              </button>

              <p className="text-center text-xs text-[#6B6259] mt-3">🔒 Pago seguro y encriptado</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
