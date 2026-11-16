export default function Footer({ setActiveTab }) {
  return (
    <footer className="border-t border-surface-border py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">

          <div className="flex items-center space-x-2">
            <span className="font-display font-bold text-sm text-gray-800">
              Segmenta <span className="text-gradient font-bold">AI</span>
            </span>
            <span>·</span>
            <span>Segmentación de clientes con K-Means y DBSCAN</span>
          </div>

          <div className="flex items-center space-x-5">
            <button
              onClick={() => setActiveTab('landing')}
              className="hover:text-brand-700 transition-colors"
            >
              Inicio
            </button>
            <button
              onClick={() => setActiveTab('tool')}
              className="hover:text-brand-700 transition-colors"
            >
              Segmentar
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className="hover:text-brand-700 transition-colors"
            >
              Modelos & Dataset
            </button>
          </div>

          <div className="text-[11px] text-gray-400">
            Proyecto académico · Dataset Customer Personality Analysis
          </div>

        </div>
      </div>
    </footer>
  );
}
