import { useLocation, Link } from 'react-router';

export default function Confirmation() {
  const { state } = useLocation();

  const orderNumber = state?.orderNumber || 'NID-10046';
  const paymentMethod: 'card' | 'transfer' = state?.paymentMethod || 'card';
  const total: number = state?.total || 0;
  const customerName: string = state?.customerName || '';

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#EDF3EF] mb-6">
        <svg className="w-10 h-10 text-[#3E5C4B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-[#2A2521] mb-2">
        ¡Pedido confirmado{customerName ? `, ${customerName.split(' ')[0]}` : ''}!
      </h1>
      <p className="text-[#6B6259] mb-6">
        Gracias por tu compra. Te enviaremos una confirmación por correo electrónico.
      </p>

      <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 text-left mb-6">
        <div className="flex items-center justify-between mb-5 pb-5 border-b border-[#E6DBC9]">
          <div>
            <p className="text-xs text-[#6B6259] mb-1">Número de pedido</p>
            <p className="text-xl font-semibold text-[#3E5C4B]">{orderNumber}</p>
          </div>
          <span className="text-xs font-semibold bg-[#EDF3EF] text-[#3E5C4B] px-3 py-1.5 rounded-full">Confirmado</span>
        </div>

        <div className="grid grid-cols-2 gap-5 text-sm mb-5">
          <div>
            <p className="text-xs text-[#6B6259] mb-0.5">Total pagado</p>
            <p className="font-semibold text-[#2A2521]">${total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6B6259] mb-0.5">Método de pago</p>
            <p className="font-semibold text-[#2A2521]">
              {paymentMethod === 'card' ? 'Tarjeta de crédito/débito' : 'Transferencia bancaria'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6B6259] mb-0.5">Tiempo estimado</p>
            <p className="font-semibold text-[#2A2521]">3–5 días hábiles</p>
          </div>
          <div>
            <p className="text-xs text-[#6B6259] mb-0.5">Fecha</p>
            <p className="font-semibold text-[#2A2521]">{new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {paymentMethod === 'transfer' && (
          <div className="bg-[#F8EDE8] border border-[#B8623F]/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">⏳</span>
              <div>
                <p className="text-sm font-semibold text-[#B8623F] mb-1">Pendiente de verificación</p>
                <p className="text-xs text-[#6B6259] leading-relaxed">
                  Si aún no has enviado el comprobante de transferencia, puedes enviarlo a
                  {' '}<strong>pagos@nidohogar.com</strong> con el número de pedido <strong>{orderNumber}</strong> como asunto.
                  Tu pedido se procesará en un plazo de 24 horas hábiles después de verificar el pago.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next steps */}
      <div className="bg-white rounded-xl border border-[#E6DBC9] p-6 text-left mb-8">
        <p className="text-sm font-semibold text-[#2A2521] mb-4">¿Qué sigue?</p>
        <div className="space-y-4">
          {[
            { icon: '📧', title: 'Correo de confirmación', desc: 'Recibirás los detalles de tu pedido en tu correo electrónico.' },
            { icon: '📦', title: 'Preparación', desc: 'Nuestro equipo preparará y empacará tu pedido con cuidado.' },
            { icon: '🚚', title: 'Envío', desc: 'Te notificaremos cuando tu pedido esté en camino con número de seguimiento.' },
          ].map(step => (
            <div key={step.title} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{step.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#2A2521]">{step.title}</p>
                <p className="text-xs text-[#6B6259]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-[#3E5C4B] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#2e4437] transition-colors"
        >
          Continuar comprando
        </Link>
        <a
          href="#"
          className="inline-flex items-center justify-center gap-2 border border-[#E6DBC9] text-[#2A2521] px-6 py-3 rounded-lg font-semibold text-sm hover:bg-[#F9F1E6] transition-colors"
        >
          Seguir mi pedido
        </a>
      </div>
    </div>
  );
}
