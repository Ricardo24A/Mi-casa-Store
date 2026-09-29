import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminNewProduct from './pages/admin/AdminNewProduct';
import AdminDiscounts from './pages/admin/AdminDiscounts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCategories from './pages/admin/AdminCategories';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'catalogo', Component: Catalog },
      { path: 'categoria/:categoryId', Component: Catalog },
      { path: 'producto/:productId', Component: Product },
      { path: 'carrito', Component: Cart },
      { path: 'checkout', Component: Checkout },
      { path: 'confirmacion', Component: Confirmation },
      { path: 'cuenta', Component: () => (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-2xl mb-4">👤</p>
          <h2 className="text-xl font-semibold text-[#2A2521] mb-2">Mi cuenta</h2>
          <p className="text-sm text-[#6B6259]">Función disponible próximamente</p>
        </div>
      )},
    ],
  },
  {
    path: '/admin',
    Component: AdminLogin,
  },
  {
    path: '/admin',
    Component: AdminLayout,
    children: [
      { path: 'resumen', Component: AdminDashboard },
      { path: 'productos', Component: AdminProducts },
      { path: 'productos/nuevo', Component: AdminNewProduct },
      { path: 'categorias', Component: AdminCategories },
      { path: 'descuentos', Component: AdminDiscounts },
      { path: 'pedidos', Component: AdminOrders },
      { path: 'configuracion', Component: AdminSettings },
    ],
  },
]);
