import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingHero from './components/LandingHero';
import SegmentTool from './components/SegmentTool';
import ModelMetrics from './components/ModelMetrics';
import Footer from './components/Footer';

export default function App() {
  const [activeTab, setActiveTab] = useState('tool'); //La aplicación abre directamente en la herramienta

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['landing', 'tool', 'metrics'].includes(hash)) {
        setActiveTab(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const changeTab = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-gray-900 selection:bg-brand-100 selection:text-brand-900">
      {/*Barra de navegación superior*/}
      <Navbar activeTab={activeTab} setActiveTab={changeTab} />

      {/*Contenido principal*/}
      <main className="flex-1">
        {activeTab === 'landing' && (
          <LandingHero
            onStartTool={() => changeTab('tool')}
            onGoToMetrics={() => changeTab('metrics')}
          />
        )}
        {activeTab === 'tool' && <SegmentTool />}
        {activeTab === 'metrics' && <ModelMetrics />}
      </main>

      {/*Pie de página*/}
      <Footer setActiveTab={changeTab} />
    </div>
  );
}
