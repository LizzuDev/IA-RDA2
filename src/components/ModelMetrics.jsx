import { useState, useEffect } from 'react';
import { fetchModelsComparison, fetchPcaPoints, MODEL_COMPARISON, METADATA } from '../services/api';
import { DBSCAN_COLORS, featureGroups, num, pctValue, primaryModel, segmentList } from '../utils/format';
import PcaScatter from './PcaScatter';

const formatParam = (value) => (typeof value === 'number' ? num(value, 4) : String(value));

export default function ModelMetrics() {
  const [data, setData] = useState(MODEL_COMPARISON);
  const [activeModel, setActiveModel] = useState(MODEL_COMPARISON.primary_model);
  const [points, setPoints] = useState(null);
  const metadata = METADATA;

  useEffect(() => {
    let mounted = true;
    fetchModelsComparison().then((res) => {
      if (mounted && res) setData(res);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchPcaPoints(activeModel).then((p) => { if (mounted) setPoints(p); });
    return () => { mounted = false; };
  }, [activeModel]);

  const { dataset, models } = data;
  const primary = primaryModel(data);
  const selected = models.find((m) => m.id === activeModel) || primary;
  const segments = segmentList(metadata);
  const sizes = Object.entries(selected.metrics.cluster_sizes)
    .map(([id, size]) => ({ id: Number(id), size }))
    .sort((a, b) => b.size - a.size);
  const maxSize = Math.max(...sizes.map((s) => s.size));
  const clusterInfo = (id) => {
    if (selected.id === 'kmeans') {
      const s = metadata.segments[String(id)];
      return { name: s?.name ?? `Cluster ${id}`, color: s?.color ?? '#9CA3AF' };
    }
    return id === 0
      ? { name: 'Núcleo denso principal', color: DBSCAN_COLORS.main }
      : { name: `Grupo pequeño ${id}`, color: DBSCAN_COLORS.micro };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-8">

      {/*Encabezado*/}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          Modelos & Dataset
        </p>
        <h1 className="mt-3 font-display font-semibold text-4xl sm:text-5xl text-gray-900 leading-[1.1] tracking-tight">
          Con qué datos se agrupó y cómo se eligieron los modelos.
        </h1>
        <p className="mt-5 text-base text-gray-600 leading-relaxed max-w-2xl">
          Los dos algoritmos trabajan con las mismas variables, que primero se estandarizan y luego se proyectan con PCA.
          Como no existen etiquetas, los modelos se comparan con métricas internas como el coeficiente Silhouette.
        </p>
      </header>

      {/*Dataset*/}
      <section className="mt-16 pt-12 border-t border-surface-border grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-12">
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-display text-2xl sm:text-3xl text-gray-900 tracking-tight">
            Customer Personality Analysis
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Contiene clientes de una cadena de tiendas con sus datos personales, lo que gastaron en seis categorías
            durante dos años y el número de compras que hicieron por cada canal.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Los ingresos faltantes se completaron con la mediana de {num(metadata.income_imputation_median)} $ y las
            variables se estandarizaron antes de aplicar PCA.
          </p>
        </div>

        <div className="md:col-span-3 space-y-10">
          {/*Composición por segmento*/}
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-5xl font-semibold text-gray-900 tracking-tight tabular-nums">
                {num(dataset.total)}
              </span>
              <span className="text-sm text-gray-500">clientes analizados</span>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden" role="img"
              aria-label={segments.map((s) => `${s.size} ${s.name}`).join(', ')}>
              {segments.map((s) => (
                <div key={s.id} style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 tabular-nums">
              {segments.map((s) => (
                <span key={s.id}>
                  <span className="font-semibold" style={{ color: s.color }}>{s.size}</span> {s.short_name.toLowerCase()} · {pctValue(s.percentage)}
                </span>
              ))}
            </div>
          </div>

          {/*Variables y PCA*/}
          <dl className="grid grid-cols-2 border-t border-surface-border">
            <div className="pt-5 pr-6 border-r border-surface-border">
              <dt className="text-xs text-gray-500">Variables</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-gray-900 tabular-nums">{dataset.n_features}</dd>
              <dd className="mt-1 text-xs text-gray-500 leading-relaxed">Perfil, gasto por categoría y canales de compra</dd>
            </div>
            <div className="pt-5 pl-6">
              <dt className="text-xs text-gray-500">Componentes PCA</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-gray-900 tabular-nums">{dataset.n_components}</dd>
              <dd className="mt-1 text-xs text-gray-500 leading-relaxed">
                Explican el {pctValue(metadata.pca.total_explained_variance * 100)} de la varianza
                ({metadata.pca.explained_variance.map((v) => pctValue(v * 100)).join(' + ')})
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/*Variables*/}
      <section className="mt-16 pt-12 border-t border-surface-border">
        <h2 className="font-display text-2xl sm:text-3xl text-gray-900 tracking-tight">
          Las {metadata.features.length} variables
        </h2>
        <p className="mt-2 text-sm text-gray-500 max-w-2xl">
          Son las mismas que pide el formulario de segmentación, agrupadas por tipo.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8">
          {featureGroups(metadata).map(({ group, features }) => (
            <dl key={group}>
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2">{group}</p>
              {features.map((f) => (
                <div key={f} className="py-2.5 border-b border-surface-border flex justify-between gap-4">
                  <dt className="text-sm text-gray-900">{metadata.feature_info[f].label}</dt>
                  <dd className="text-xs text-gray-400 font-mono shrink-0">{metadata.feature_info[f].unit || 'sin unidad'}</dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </section>

      {/*Criterio*/}
      <section className="mt-16 pt-12 border-t border-surface-border grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
        <blockquote className="md:col-span-3 font-display text-2xl sm:text-3xl font-semibold text-gray-900 leading-snug tracking-tight">
          Un buen segmento es <span className="text-gradient">compacto</span> por dentro y está
          bien separado de los demás. Eso es lo que mide el coeficiente Silhouette.
        </blockquote>
        <div className="md:col-span-2 space-y-3 text-sm text-gray-600 leading-relaxed md:pt-2">
          <p>{data.selection_criterion}</p>
          <p>
            El modelo principal es <strong className="font-semibold text-gray-900">{primary.name}</strong>, que obtiene un
            Silhouette de {primary.metrics.silhouette.toFixed(3)} con {primary.metrics.n_clusters} segmentos.
            DBSCAN se usa como apoyo para detectar clientes atípicos.
          </p>
        </div>
      </section>

      {/*Comparación*/}
      <section className="mt-16 pt-12 border-t border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="font-display text-2xl sm:text-3xl text-gray-900 tracking-tight">
            Comparación de modelos
          </h2>
          <span className="text-xs text-gray-500">{num(dataset.total)} clientes en un espacio PCA de {dataset.n_components} componentes</span>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-[11px] uppercase tracking-wider text-gray-500">
                <th className="py-3 pr-4 pl-3 font-semibold">Modelo</th>
                <th className="py-3 px-4 font-semibold text-right">Clusters</th>
                <th className="py-3 px-4 font-semibold text-right">Silhouette</th>
                <th className="py-3 px-4 font-semibold text-right">Ruido</th>
                <th className="py-3 px-4 font-semibold">Cluster más grande</th>
                <th className="py-3 pl-4 font-semibold text-right">Hiperparámetros</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const isActive = selected.id === m.id;
                return (
                  <tr
                    key={m.id}
                    onClick={() => setActiveModel(m.id)}
                    className={`cursor-pointer border-b border-surface-border transition-colors ${
                      isActive ? 'bg-brand-50/70' : 'hover:bg-brand-50/40'
                    }`}
                  >
                    <td className={`py-4 pr-4 pl-3 border-l-2 ${isActive ? 'border-brand-600' : 'border-transparent'}`}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveModel(m.id); }}
                        aria-pressed={isActive}
                        className="text-left font-semibold text-gray-900"
                      >
                        {m.name}
                      </button>
                      <span className={`block text-xs mt-0.5 ${m.is_recommended ? 'text-brand-700' : 'text-gray-400'}`}>
                        {m.is_recommended ? 'Modelo principal' : 'Detección de atípicos'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-gray-900 tabular-nums">{m.metrics.n_clusters}</td>
                    <td className="py-4 px-4 text-right font-mono text-gray-700 tabular-nums">{m.metrics.silhouette.toFixed(3)}</td>
                    <td className="py-4 px-4 text-right font-mono text-gray-700 tabular-nums">
                      {pctValue(m.metrics.noise_pct, 2)}
                      <span className="text-gray-400"> ({m.metrics.noise_count})</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1 bg-brand-100">
                          <div className="h-1 bg-brand-500" style={{ width: `${m.metrics.largest_cluster_pct}%` }} />
                        </div>
                        <span className="font-mono text-gray-900 tabular-nums">{pctValue(m.metrics.largest_cluster_pct)}</span>
                      </div>
                    </td>
                    <td className="py-4 pl-4 text-right font-mono text-xs text-gray-600">
                      {Object.entries(m.hyperparameters).filter(([k]) => k !== 'random_state' && k !== 'n_init')
                        .map(([k, v]) => `${k}=${v}`).join(' · ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          El Silhouette de DBSCAN se calcula sin los puntos de ruido. Un valor negativo indica que sus grupos pequeños se cruzan con el núcleo.
        </p>
      </section>

      {/*Detalle del modelo seleccionado*/}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-12" aria-live="polite">
        <div className="md:col-span-2">
          <p className="text-xs font-mono text-brand-600">{selected.id}</p>
          <h3 className="mt-1 font-display text-2xl text-gray-900 tracking-tight">{selected.name}</h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{selected.description}</p>

          <dl className="mt-6 text-sm">
            {Object.entries(selected.hyperparameters).map(([p, v]) => (
              <DetailRow key={p} label={<span className="font-mono">{p}</span>} value={formatParam(v)} />
            ))}
            {selected.metrics.inertia !== undefined && (
              <DetailRow label="Inercia, suma de distancias al cuadrado" value={num(selected.metrics.inertia, 2)} />
            )}
            <DetailRow label="Silhouette" value={selected.metrics.silhouette.toFixed(4)} />
          </dl>

          <p className="mt-8 text-sm font-semibold text-gray-900">Tamaño de cada cluster</p>
          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {sizes.map(({ id, size }) => {
              const info = clusterInfo(id);
              return (
                <div key={id} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-xs">
                  <span className="text-gray-700 truncate" title={info.name}>{info.name}</span>
                  <div className="h-1.5 bg-gray-100">
                    <div className="h-1.5" style={{ width: `${Math.max((size / maxSize) * 100, 1)}%`, backgroundColor: info.color }} />
                  </div>
                  <span className="font-mono text-right text-gray-900 tabular-nums">{size}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3 min-w-0 space-y-10">
          {selected.id === 'kmeans' ? (
            <div>
              <p className="text-sm font-semibold text-gray-900">Elección de K con el codo y el Silhouette</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                La inercia siempre baja al aumentar K, por eso se busca el punto donde deja de bajar rápido. Con K igual a{' '}
                {selected.metrics.n_clusters} se logra un Silhouette alto y segmentos útiles para el negocio.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <LineChart
                  data={data.k_search.map((r) => ({ x: r.k, y: r.inertia }))}
                  highlightX={selected.metrics.n_clusters}
                  xLabel="K" yLabel="Inercia" label="Curva del codo con la inercia por K" digits={0}
                />
                <LineChart
                  data={data.k_search.map((r) => ({ x: r.k, y: r.silhouette }))}
                  highlightX={selected.metrics.n_clusters}
                  xLabel="K" yLabel="Silhouette" label="Silhouette por K" digits={3}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-gray-900">Elección de eps con el gráfico de distancia k</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Muestra la distancia de cada cliente a su vecino número {data.k_dist.min_samples}, ordenada de menor a mayor. El codo
                de la curva marca eps igual a {data.k_dist.eps}. Por encima de ese valor los clientes quedan aislados y se consideran ruido.
              </p>
              <div className="mt-4 max-w-md">
                <LineChart
                  data={data.k_dist.curve.map((y, i) => ({ x: i * data.k_dist.step, y }))}
                  refY={data.k_dist.eps}
                  refLabel={`eps = ${data.k_dist.eps}`}
                  xLabel="Clientes ordenados por distancia" yLabel="Distancia k" label="Gráfico de distancia k" digits={2}
                  showDots={false}
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-900">Clusters en el espacio PCA</p>
            <div className="mt-4">
              <PcaScatter points={points} model={selected.id} metadata={metadata} />
            </div>
          </div>
        </div>
      </section>

      <p className="mt-16 pt-6 border-t border-surface-border text-xs text-gray-400">
        Datos de {metadata.dataset}. Modelos entrenados con scikit-learn {data.environment?.scikit_learn}.
      </p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-surface-border">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-mono text-gray-900 tabular-nums">{value}</dd>
    </div>
  );
}

//Gráfico de líneas sencillo hecho en SVG
function LineChart({ data, highlightX, refY, refLabel, xLabel, yLabel, label, digits = 2, showDots = true }) {
  const W = 320;
  const H = 200;
  const pad = { top: 14, right: 14, bottom: 34, left: 48 };
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y).concat(refY ?? []);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(...ys) * 1.05;
  const sx = (v) => pad.left + ((v - x0) / (x1 - x0 || 1)) * (W - pad.left - pad.right);
  const sy = (v) => H - pad.bottom - ((v - y0) / (y1 - y0 || 1)) * (H - pad.top - pad.bottom);
  const yTicks = [y0, (y0 + y1) / 2, y1];
  const xTicks = showDots ? xs : [x0, Math.round((x0 + x1) / 2), x1];
  const line = data.map((d) => `${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
      <rect x={pad.left} y={pad.top} width={W - pad.left - pad.right} height={H - pad.top - pad.bottom} fill="none" stroke="#F1E6E9" />
      {yTicks.map((t, i) => (
        <text key={i} x={pad.left - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#6B7280">{num(t, digits)}</text>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={sx(t)} y={H - pad.bottom + 13} textAnchor="middle" fontSize="9" fill="#6B7280">{num(t)}</text>
      ))}
      {highlightX !== undefined && (
        <line x1={sx(highlightX)} x2={sx(highlightX)} y1={pad.top} y2={H - pad.bottom} stroke="#FF94C2" strokeDasharray="3 3" />
      )}
      {refY !== undefined && (
        <g>
          <line x1={pad.left} x2={W - pad.right} y1={sy(refY)} y2={sy(refY)} stroke="#F59E0B" strokeDasharray="4 3" />
          <text x={pad.left + 6} y={sy(refY) - 5} fontSize="9" fill="#B45309">{refLabel}</text>
        </g>
      )}
      <polyline points={line} fill="none" stroke="#DB1D69" strokeWidth="1.6" />
      {showDots && data.map((d) => (
        <circle key={d.x} cx={sx(d.x)} cy={sy(d.y)} r={d.x === highlightX ? 4 : 2.5}
          fill={d.x === highlightX ? '#DB1D69' : '#FFFFFF'} stroke="#DB1D69" strokeWidth="1.4">
          <title>{`${xLabel} = ${d.x} · ${yLabel} = ${num(d.y, digits)}`}</title>
        </circle>
      ))}
      <text x={(W + pad.left) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#6B7280">{xLabel}</text>
      <text x={10} y={(H - pad.bottom) / 2} textAnchor="middle" fontSize="9" fill="#6B7280"
        transform={`rotate(-90 10 ${(H - pad.bottom) / 2})`}>{yLabel}</text>
    </svg>
  );
}
