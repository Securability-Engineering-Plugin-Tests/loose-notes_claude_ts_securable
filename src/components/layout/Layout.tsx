import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ToastContainer } from '@/components/ui/Toast';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-500">
        Loose Notes &copy; {new Date().getFullYear()}
      </footer>
      <ToastContainer />
    </div>
  );
}
