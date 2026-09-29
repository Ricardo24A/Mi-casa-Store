import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAdmin } from '../../store/AdminContext';

export default function AdminLogin() {
  const { login } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@nidohogar.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const ok = login(email, password);
      if (ok) {
        navigate('/admin/resumen');
      } else {
        setError('Credenciales incorrectas. Usa admin@nidohogar.com / admin123');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F9F1E6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#3E5C4B]">Nido Hogar</h1>
          <p className="text-sm text-[#6B6259] mt-1">Panel de administración</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E6DBC9] p-8">
          <h2 className="text-lg font-semibold text-[#2A2521] mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@nidohogar.com"
                className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B] focus:ring-1 focus:ring-[#3E5C4B]/20 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2A2521] mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 text-sm border border-[#E6DBC9] rounded-lg bg-white text-[#2A2521] placeholder-[#6B6259] focus:outline-none focus:border-[#3E5C4B] focus:ring-1 focus:ring-[#3E5C4B]/20 transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-[#F8EDE8] border border-[#B8623F]/20 rounded-lg px-3 py-2.5 text-xs text-[#B8623F]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 font-semibold text-sm rounded-lg transition-colors ${
                loading ? 'bg-[#6B6259] text-white cursor-not-allowed' : 'bg-[#3E5C4B] text-white hover:bg-[#2e4437]'
              }`}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E6DBC9]">
            <p className="text-xs text-center text-[#6B6259]">
              Credenciales de demo:<br />
              <span className="font-semibold text-[#2A2521]">admin@nidohogar.com</span> / <span className="font-semibold text-[#2A2521]">admin123</span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#6B6259] mt-6">
          <a href="/" className="text-[#3E5C4B] hover:underline">← Volver a la tienda</a>
        </p>
      </div>
    </div>
  );
}
