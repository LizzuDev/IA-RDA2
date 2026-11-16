import { useMemo } from 'react';
import { DBSCAN_COLORS, clusterColor, segmentList } from '../utils/format';

const W = 640;
const H = 400;
const PAD = { top: 16, right: 16, bottom: 40, left: 44 };

//Estrella de 5 puntas centrada en el punto cx, cy
function starPath(cx, cy, outer = 11, inner = 4.6) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function niceTicks(min, max) {
  const step = (max - min) > 8 ? 2 : 1;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);
  return ticks;
}

//Mapa 2D de los clientes en el espacio PCA, coloreado según el cluster del modelo
//Si llega star con x, y y color, se dibuja al cliente evaluado como una estrella
export default function PcaScatter({ points, model, metadata, star = null }) {
  const domain = useMemo(() => {
    const xs = (points ?? []).map((p) => p.x);
    const ys = (points ?? []).map((p) => p.y);
    if (star) { xs.push(star.x); ys.push(star.y); }
    if (!xs.length) return null;
    const padX = 0.5;
    const padY = 0.5;
    return {
      x0: Math.floor(Math.min(...xs) - padX), x1: Math.ceil(Math.max(...xs) + padX),
      y0: Math.floor(Math.min(...ys) - padY), y1: Math.ceil(Math.max(...ys) + padY),
    };
  }, [points, star]);

  const [labelX, labelY] = metadata.pca.axis_labels;
  const legend = model === 'kmeans'
    ? segmentList(metadata).map((s) => ({ color: s.color, label: s.name }))
    : [
      { color: DBSCAN_COLORS.main, label: 'Núcleo denso principal' },
      { color: DBSCAN_COLORS.micro, label: 'Grupos pequeños' },
      { color: DBSCAN_COLORS.noise, label: 'Ruido o atípicos' },
    ];

  if (!points || !domain) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-gray-400 bg-surface-subtle/60">
        El mapa de clientes está disponible cuando la API está activa.
      </div>
    );
  }

  const sx = (v) => PAD.left + ((v - domain.x0) / (domain.x1 - domain.x0)) * (W - PAD.left - PAD.right);
  const sy = (v) => H - PAD.bottom - ((v - domain.y0) / (domain.y1 - domain.y0)) * (H - PAD.top - PAD.bottom);
  //El ruido se dibuja al final para que no quede tapado por el núcleo denso
  const ordered = model === 'dbscan' ? [...points].sort((a, b) => (a.cluster === -1) - (b.cluster === -1)) : points;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Mapa PCA de ${points.length} clientes coloreados por ${model === 'kmeans' ? 'segmento de K-Means' : 'cluster de DBSCAN'}`}>
        {/*Ejes y rejilla*/}
        {niceTicks(domain.x0, domain.x1).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.top} y2={H - PAD.bottom} stroke={t === 0 ? '#D1D5DB' : '#EEF2F1'} />
            <text x={sx(t)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="10" fill="#9CA3AF">{t}</text>
          </g>
        ))}
        {niceTicks(domain.y0, domain.y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? '#D1D5DB' : '#EEF2F1'} />
            <text x={PAD.left - 8} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="#9CA3AF">{t}</text>
          </g>
        ))}
        <text x={(W + PAD.left) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#6B7280">{labelX}</text>
        <text x={12} y={(H - PAD.bottom) / 2} textAnchor="middle" fontSize="11" fill="#6B7280"
          transform={`rotate(-90 12 ${(H - PAD.bottom) / 2})`}>{labelY}</text>

        {/*Clientes*/}
        <g>
          {ordered.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={model === 'dbscan' && p.cluster === -1 ? 3 : 2.2}
              fill={clusterColor(model, p.cluster, metadata)}
              fillOpacity={model === 'dbscan' && p.cluster === 0 ? 0.35 : 0.6} />
          ))}
        </g>

        {/*Centroides de K-Means*/}
        {model === 'kmeans' && segmentList(metadata).map((s) => (
          <g key={s.id} stroke="#111827" strokeWidth="1.5">
            <line x1={sx(s.centroid_pca[0]) - 5} x2={sx(s.centroid_pca[0]) + 5} y1={sy(s.centroid_pca[1])} y2={sy(s.centroid_pca[1])} />
            <line x1={sx(s.centroid_pca[0])} x2={sx(s.centroid_pca[0])} y1={sy(s.centroid_pca[1]) - 5} y2={sy(s.centroid_pca[1]) + 5} />
          </g>
        ))}

        {/*Cliente evaluado*/}
        {star && (
          <path d={starPath(sx(star.x), sy(star.y))} fill={star.color} stroke="#111827" strokeWidth="1.5"
            data-testid="pca-star">
            <title>{`Cliente evaluado (${star.x.toFixed(2)}, ${star.y.toFixed(2)})`}</title>
          </path>
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-gray-600">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2" style={{ backgroundColor: l.color }} aria-hidden="true" />
            {l.label}
          </span>
        ))}
        {model === 'kmeans' && <span className="text-gray-400">La cruz marca el centroide</span>}
        {star && <span className="text-gray-900 font-semibold">★ cliente evaluado</span>}
      </figcaption>
    </figure>
  );
}
