import { useState, useEffect } from 'react';
import { Home, Users, Database, Menu, X } from 'lucide-react';
import { checkApiHealth } from '../services/api';

export default function Navbar({ activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    let timer;
    //Si la API no responde se vuelve a probar a los 5 segundos y si está activa cada 15 segundos
    async function verify() {
      const res = await checkApiHealth();
      if (!isMounted) return;
      const online = res.status === 'healthy';
      setApiStatus(online ? 'online' : 'offline');
      timer = setTimeout(verify, online ? 15000 : 5000);
    }
    verify();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const navItems = [
    { id: 'landing', label: 'Inicio', icon: Home },
    { id: 'tool', label: 'Segmentar', icon: Users },
    { id: 'metrics', label: 'Modelos & Dataset', icon: Database },
  ];

  return (
    <header className="bg-surface-bg/85 backdrop-blur-md border-b border-surface-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/*Marca*/}
          <button
            onClick={() => setActiveTab('landing')}
            className="flex items-center space-x-3 text-left focus:outline-none group"
          >
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-bold text-xl text-gray-900">
                  Segmenta
                </span>
                <span className="text-xs font-bold text-gradient">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium hidden sm:block leading-none">
                Segmentación de clientes
              </p>
            </div>
          </button>

          {/*Navegación de escritorio*/}
          <nav className="hidden md:flex items-center space-x-1 h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`h-16 flex items-center space-x-2 px-3 border-b-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/*Estado de la API*/}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-gray-600 font-medium">
              <span className={`w-2 h-2 rounded-full ${
                apiStatus === 'online'
                  ? 'bg-emerald-500 ring-2 ring-emerald-100'
                  : apiStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-gray-400'
              }`}></span>
              <span className="text-gray-700">
                {apiStatus === 'online' ? 'Servicio activo' : apiStatus === 'checking' ? 'Conectando...' : 'Modo local'}
              </span>
            </div>
          </div>

          {/*Botón del menú móvil*/}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/*Menú móvil*/}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-surface-border bg-surface-bg px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 border-l-2 text-xs font-semibold ${
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
