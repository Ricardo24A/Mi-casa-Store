import { useState } from 'react';

interface BankAccount {
  id: string;
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  nit: string;
}

export default function AdminSettings() {
  const [store, setStore] = useState({
    name: 'Nido Hogar',
    email: 'hola@nidohogar.com',
    phone: '+57 300 000 0000',
    address: 'Calle 45 #12-34, Bogotá, Colombia',
    description: 'Todo lo que tu hogar necesita, con la calidad que merece.',
    instagram: '@nidohogar',
    facebook: 'nidohogar',
  });

  const [shipping, setShipping] = useState({
    baseCost: '8.99',
    freeAbove: '50',
    estimatedDays: '3-5',
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: 'b1',
      bank: 'Banco de Occidente',
      accountType: 'Cuenta de ahorros',
      accountNumber: '123-456789-01',
      holder: 'Nido Hogar S.A.S.',
      nit: '900.123.456-7',
    },
  ]);

  const [showBankForm, setShowBankForm] = useState(false);
  const [newBank, setNewBank] = useState<Omit<BankAccount, 'id'>>({
    bank: '',
    accountType: 'Cuenta de ahorros',
    accountNumber: '',
    holder: '',
    nit: '',
  });

  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addBankAccount = () => {
    if (!newBank.bank || !newBank.accountNumber) return;
    setBankAccounts(list => [...list, { ...newBank, id: `b${Date.now()}` }]);
    setNewBank({ bank: '', accountType: 'Cuenta de ahorros', accountNumber: '', holder: '', nit: '' });
    setShowBankForm(false);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 mb-5">
      <h2 className="font-semibold text-[#2A2521] mb-5">{title}</h2>
      {children}
    </div>
  );

  const Field = ({
    label, value, onChange, type = 'text', placeholder,
  }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] placeholder-[#6B6259]"
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#2A2521]">Configuración</h1>
        <p className="text-sm text-[#6B6259] mt-0.5">Gestiona los datos y preferencias de tu tienda</p>
      </div>

      <form onSubmit={handleSave}>
        <Section title="Datos del negocio">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre de la tienda" value={store.name} onChange={v => setStore(s => ({ ...s, name: v }))} />
              <Field label="Correo de contacto" value={store.email} onChange={v => setStore(s => ({ ...s, email: v }))} type="email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono" value={store.phone} onChange={v => setStore(s => ({ ...s, phone: v }))} />
              <Field label="Dirección" value={store.address} onChange={v => setStore(s => ({ ...s, address: v }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Descripción</label>
              <textarea
                value={store.description}
                onChange={e => setStore(s => ({ ...s, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Instagram" value={store.instagram} onChange={v => setStore(s => ({ ...s, instagram: v }))} placeholder="@tutienda" />
              <Field label="Facebook" value={store.facebook} onChange={v => setStore(s => ({ ...s, facebook: v }))} placeholder="tutienda" />
            </div>
          </div>
        </Section>

        <Section title="Envío">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Costo base (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6259]">$</span>
                  <input
                    type="number"
                    value={shipping.baseCost}
                    onChange={e => setShipping(s => ({ ...s, baseCost: e.target.value }))}
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Envío gratis desde (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6259]">$</span>
                  <input
                    type="number"
                    value={shipping.freeAbove}
                    onChange={e => setShipping(s => ({ ...s, freeAbove: e.target.value }))}
                    step="1"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521]"
                  />
                </div>
              </div>
              <Field
                label="Días estimados"
                value={shipping.estimatedDays}
                onChange={v => setShipping(s => ({ ...s, estimatedDays: v }))}
                placeholder="3-5"
              />
            </div>
            <div className="bg-[#EDF3EF] rounded-lg px-4 py-3 text-xs text-[#3E5C4B]">
              💡 Con la configuración actual, los pedidos superiores a <strong>${shipping.freeAbove}</strong> tienen envío gratis. El resto paga <strong>${shipping.baseCost}</strong>.
            </div>
          </div>
        </Section>

        <Section title="Cuentas bancarias para transferencia">
          <div className="space-y-3 mb-4">
            {bankAccounts.map(account => (
              <div key={account.id} className="bg-[#F9F1E6] rounded-lg p-4 border border-[#E6DBC9]">
                <div className="flex items-start justify-between">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 flex-1">
                    {[
                      ['Banco', account.bank],
                      ['Tipo', account.accountType],
                      ['Número de cuenta', account.accountNumber],
                      ['Titular', account.holder],
                      ['NIT', account.nit],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-[#6B6259]">{k}</p>
                        <p className="text-xs font-semibold text-[#2A2521]">{v}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBankAccounts(list => list.filter(a => a.id !== account.id))}
                    className="p-1.5 text-[#6B6259] hover:text-[#B8623F] transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showBankForm && (
            <div className="bg-white border border-[#E6DBC9] rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Banco', key: 'bank', placeholder: 'Banco de Occidente' },
                  { label: 'Titular', key: 'holder', placeholder: 'Mi Empresa S.A.S.' },
                  { label: 'Número de cuenta', key: 'accountNumber', placeholder: '123-456789-01' },
                  { label: 'NIT', key: 'nit', placeholder: '900.123.456-7' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-[#2A2521] mb-1">{label}</label>
                    <input
                      type="text"
                      value={(newBank as Record<string, string>)[key]}
                      onChange={e => setNewBank(b => ({ ...b, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] placeholder-[#6B6259]"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2A2521] mb-1">Tipo de cuenta</label>
                <select
                  value={newBank.accountType}
                  onChange={e => setNewBank(b => ({ ...b, accountType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E6DBC9] rounded-lg focus:outline-none focus:border-[#3E5C4B] text-[#2A2521] cursor-pointer bg-white"
                >
                  <option>Cuenta de ahorros</option>
                  <option>Cuenta corriente</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addBankAccount} className="px-4 py-2 bg-[#3E5C4B] text-white text-xs font-semibold rounded-lg hover:bg-[#2e4437] transition-colors">
                  Agregar cuenta
                </button>
                <button type="button" onClick={() => setShowBankForm(false)} className="px-4 py-2 border border-[#E6DBC9] text-xs font-semibold rounded-lg hover:bg-[#F9F1E6] transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!showBankForm && (
            <button
              type="button"
              onClick={() => setShowBankForm(true)}
              className="flex items-center gap-2 text-sm text-[#3E5C4B] font-semibold hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
              </svg>
              Agregar cuenta bancaria
            </button>
          )}
        </Section>

        <button
          type="submit"
          className={`px-6 py-3 font-semibold text-sm rounded-lg transition-all ${saved ? 'bg-[#EDF3EF] text-[#3E5C4B]' : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'}`}
        >
          {saved ? '✓ Cambios guardados' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
