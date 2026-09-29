import { RouterProvider } from 'react-router';
import { router } from './routes';
import { CartProvider } from './store/CartContext';
import { AdminProvider } from './store/AdminContext';

export default function App() {
  return (
    <AdminProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AdminProvider>
  );
}
