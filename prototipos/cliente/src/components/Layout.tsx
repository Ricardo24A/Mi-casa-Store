import { Outlet, Link } from 'react-router';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9F1E6]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-[#E6DBC9] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <p className="text-lg font-semibold text-[#3E5C4B] mb-3">Mi casa Store</p>
              <p className="text-sm text-[#6B6259] leading-relaxed">
                Todo lo que tu hogar necesita, con la calidad que merece.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2A2521] mb-3">Ayuda</p>
              <ul className="space-y-2">
                {['Centro de ayuda', 'Seguimiento de pedido', 'Cambios y devoluciones', 'Preguntas frecuentes'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#6B6259] hover:text-[#3E5C4B] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2A2521] mb-3">La tienda</p>
              <ul className="space-y-2">
                {['Sobre nosotros', 'Blog', 'Trabaja con nosotros', 'Sostenibilidad'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#6B6259] hover:text-[#3E5C4B] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2A2521] mb-3">Legal</p>
              <ul className="space-y-2">
                {['Términos y condiciones', 'Política de privacidad', 'Política de cookies'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#6B6259] hover:text-[#3E5C4B] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-[#E6DBC9] flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-[#6B6259]">© 2026 Nido Hogar. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              {['Instagram', 'Facebook', 'TikTok'].map(s => (
                <a key={s} href="#" className="text-xs text-[#6B6259] hover:text-[#3E5C4B] transition-colors">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
