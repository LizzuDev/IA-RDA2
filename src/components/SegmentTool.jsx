import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Minus, Plus, RotateCcw, Wand2 } from 'lucide-react';
import { METADATA, fetchMetadata, fetchPcaPoints, fetchSamples, predictSegment } from '../services/api';
import { featureGroups, medianFeatures, num, pctValue, segmentList } from '../utils/format';
import { CHANNEL_KEYS, FEATURE_ICONS, GROUP_META, SHORT_LABELS, personaTraits } from '../utils/featureMeta';
import PcaScatter from './PcaScatter';
import Persona from './Persona';

//Botones de ejemplo, cada clave existe en /api/samples y tiene su etiqueta y una descripción corta
const SAMPLE_BUTTONS = [
  { key: 'low', label: 'Ahorrador', caseLabel: 'Cliente ahorrador', color: '#64748b', blurb: 'Ingreso bajo, con hijos, gasta poco' },
  { key: 'premium', label: 'Premium', caseLabel: 'Cliente premium', color: '#7c3aed', blurb: 'Ingreso alto, gasta mucho en vino y carne' },
  { key: 'deals', label: 'Ofertas', caseLabel: 'Cliente de ofertas', color: '#f59e0b', blurb: 'Familia que compra con descuento' },
  { key: 'consolidated', label: 'Consolidado', caseLabel: 'Cliente consolidado', color: '#0ea5e9', blurb: 'Compra por web, tienda y catálogo' },
  { key: 'noise', label: 'Atípico', caseLabel: 'Cliente atípico', color: '#ef4444', blurb: 'No se parece a ningún grupo' },
];

const BASELINE_LABEL = 'Valores medianos';
const BRAND_ACCENT = '#F0357F';

const underlineTab = (active) =>
  `pb-1.5 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
    active ? 'border-brand-600 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
  }`;

//Compara el valor con el cliente típico, que es la mediana del dataset
function typicalHint(value, median) {
  if (median === 0) return value > 0 ? 'Más que lo típico' : 'Típico';
  const r = value / median;
  if (r >= 1.6) return 'Más que lo típico';
  if (r <= 0.5) return 'Menos que lo típico';
  return 'Típico';
}

const formatValue = (key, value) => (key === 'Income' || key.startsWith('Mnt') ? `$${num(value)}` : num(value));

//Cantidad que suma o resta cada clic en los botones de menos y más
const bumpStep = (key) => {
  if (key === 'Income') return 1000;
  if (key.startsWith('Mnt')) return 10;
  return 1;
};

//Botones de menos y más alrededor del valor, sirven para ajustar números pequeños con facilidad
function Stepper({ id, label, value, step, onChange, onBump, describedBy, compact = false }) {
  const btn = `${compact ? 'w-7 h-7' : 'w-9 h-9'} shrink-0 rounded-lg bg-surface-subtle text-brand-700 hover:bg-brand-100 active:bg-brand-200 flex items-center justify-center transition-colors`;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onBump(-1)} aria-label={`Disminuir ${label}`}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        aria-label={compact ? label : undefined}
        className={`${compact ? 'w-10 text-sm' : 'w-20 text-base'} py-1 text-center font-mono font-semibold bg-transparent border-b-2 border-surface-border text-gray-900 focus:border-brand-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <button type="button" className={btn} onClick={() => onBump(1)} aria-label={`Aumentar ${label}`}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

//Huella del perfil y del modelo para saber si el resultado mostrado sigue vigente
const profileKey = (features, modelId) => `${modelId}|${JSON.stringify(features)}`;

//Une los rasgos en una frase del tipo a, b y c
const sentence = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

//Encabezado de cada paso con el mismo estilo numerado de la landing
function StepHeading({ n, title, children }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-display font-bold text-4xl text-brand-200 tabular-nums leading-none">0{n}</span>
      <div>
        <h2 className="font-display font-bold text-2xl text-gray-900">{title}</h2>
        {children && <p className="mt-1 text-sm text-gray-500 max-w-2xl">{children}</p>}
      </div>
    </div>
  );
}

export default function SegmentTool() {
  const [metadata, setMetadata] = useState(METADATA);
  const [samples, setSamples] = useState(null);
  const [features, setFeatures] = useState(() => medianFeatures(METADATA));
  const [selectedModel, setSelectedModel] = useState('all'); //all usa K-Means junto con la detección de atípicos
  const [prediction, setPrediction] = useState(null);
  const [predictedFor, setPredictedFor] = useState(null); //perfil y modelo con los que se calculó el resultado
  const [runId, setRunId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSampleLabel, setActiveSampleLabel] = useState(BASELINE_LABEL);
  const [activeGroup, setActiveGroup] = useState('Perfil');
  const [mapModel, setMapModel] = useState('kmeans');
  const [points, setPoints] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchMetadata().then((m) => { if (mounted && m) setMetadata(m); });
    fetchSamples().then((s) => { if (mounted && s) setSamples(s); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchPcaPoints(mapModel).then((p) => { if (mounted) setPoints(p); });
    return () => { mounted = false; };
  }, [mapModel]);

  const clearResult = () => {
    setPrediction(null);
    setPredictedFor(null);
    setError(null);
  };

  const handleInputChange = (key, value) => {
    const n = parseFloat(value);
    setActiveSampleLabel('Personalizado');
    setFeatures((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const handleBump = (key, dir) => {
    const { min, max } = metadata.feature_stats[key];
    const step = bumpStep(key);
    const current = features[key] ?? 0;
    //Redondea al múltiplo del paso para que los clics den números exactos
    const next = dir > 0 ? Math.floor(current / step) * step + step : Math.ceil(current / step) * step - step;
    const lower = key === 'Age' ? min : 0;
    handleInputChange(key, Math.min(Math.max(next, lower), Math.max(max, current)));
  };

  const handleLoadSample = (sample, label) => {
    if (!sample?.features) return;
    setFeatures({ ...medianFeatures(metadata), ...sample.features });
    setActiveSampleLabel(label);
    clearResult();
  };

  const handleReset = () => {
    setFeatures(medianFeatures(metadata));
    setActiveSampleLabel(BASELINE_LABEL);
    setActiveGroup('Perfil');
    clearResult();
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictSegment(features, selectedModel);
      setPrediction(res);
      setPredictedFor(profileKey(features, selectedModel));
      setRunId((n) => n + 1);
      setMapModel(res.model_id === 'dbscan' ? 'dbscan' : 'kmeans');
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError(err.message || 'Ocurrió un error al comunicarse con el servicio de segmentación.');
    } finally {
      setLoading(false);
    }
  };

  const segments = segmentList(metadata);
  const groups = featureGroups(metadata);
  const groupIndex = groups.findIndex((g) => g.group === activeGroup);
  const nextGroup = groups[groupIndex + 1];
  const membership = prediction?.membership ?? prediction?.multi_model_summary?.kmeans?.membership;
  const outlier = prediction?.outlier_check;
  //El resultado deja de valer si el perfil o el modelo cambian después de calcularlo
  const isStale = Boolean(prediction) && predictedFor !== profileKey(features, selectedModel);
  const accent = prediction && !isStale ? prediction.color : BRAND_ACCENT;
  //La afinidad viene de K-Means, por eso solo se muestra cuando el resultado principal es de K-Means
  const affinity = membership && prediction?.model_id !== 'dbscan' && !prediction.is_noise ? membership[String(prediction.cluster_id)] : null;
  const traits = personaTraits(features).map((t, i) => (i === 0 ? t : t.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

      {/*Encabezado*/}
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">Segmentación de Clientes</p>
        <h1 className="mt-2 font-display font-bold text-3xl sm:text-5xl text-gray-900 leading-tight">
          Perfil del <span className="text-gradient">cliente</span>
        </h1>
        <p className="mt-3 text-base text-gray-600">
          La herramienta parte del cliente típico del dataset. Se ajustan los datos que se conocen, la ilustración
          cambia con cada valor y al final se obtiene el grupo al que pertenece el cliente.
        </p>
      </header>

      {/*Paso 1, perfil*/}
      <section className="mt-12 pt-10 border-t border-surface-border">
        <StepHeading n={1} title="Datos del cliente">
          Son las 15 variables con las que se entrenó el modelo, separadas en tres partes.
        </StepHeading>

        {/*Clientes de ejemplo*/}
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">Clientes de ejemplo.</span>{' '}
              Se puede cargar un cliente real del dataset y luego ajustar sus valores.
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-700 transition-colors"
              title="Restablecer valores"
              aria-label="Restablecer valores"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Volver al cliente típico
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SAMPLE_BUTTONS.map(({ key, label, caseLabel, color, blurb }) => {
              const active = activeSampleLabel === caseLabel;
              const sample = samples?.[key]?.[0];
              const preview = sample?.features ?? segments.find((s) => s.key === key)?.means ?? medianFeatures(metadata);
              return (
                <button
                  key={key}
                  disabled={!sample}
                  title={samples ? undefined : 'Disponible cuando la API está activa'}
                  onClick={() => handleLoadSample(sample, caseLabel)}
                  aria-pressed={active}
                  aria-label={label}
                  className={`group text-left rounded-xl border bg-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:-translate-y-0.5 enabled:hover:shadow-card ${
                    active ? 'border-transparent shadow-card' : 'border-surface-border'
                  }`}
                  style={active ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                >
                  <div className="h-24 flex justify-center overflow-hidden pt-1" style={{ backgroundColor: `${color}14` }}>
                    <div className="w-32 shrink-0">
                      <Persona features={preview} accent={color} compact showBubbles={false} decorative />
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                      <span className="w-2 h-2" style={{ backgroundColor: color }} aria-hidden="true" />
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{blurb}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/*Persona*/}
          <aside className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="relative pt-10 pb-4 bg-gradient-to-b from-brand-50/80 via-white/40 to-transparent rounded-3xl">
              <Persona features={features} metadata={metadata} accent={accent} />
            </div>

            <div className="mt-2 text-center">
              <p className="text-xs font-semibold text-brand-700">
                {activeSampleLabel}
                {prediction && !isStale && (
                  <span style={{ color: prediction.color }}>
                    {' '}→ {prediction.segment_short_name}{affinity != null && ` · ${pctValue(affinity)} de afinidad`}
                  </span>
                )}
                {isStale && <span className="text-amber-700"> · sin recalcular</span>}
              </p>
              <p className="mt-1 font-display font-bold text-xl text-gray-900">
                {Math.round(features.Age)} años · {Math.round(features.Children)} {Math.round(features.Children) === 1 ? 'hijo' : 'hijos'} · ${num(features.Income / 1000)}k al año
              </p>
              <p className="text-sm text-gray-500">Última compra hace {Math.round(features.Recency)} días</p>
              {traits.length > 0 && (
                <p className="mt-3 text-sm text-gray-700 max-w-sm mx-auto">
                  Cliente {sentence(traits)}.
                </p>
              )}
            </div>

            {/*Los canales se pueden ajustar aquí mismo, junto a la ilustración*/}
            <div className="mt-6 pt-5 border-t border-surface-border">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-gray-900">Dónde compra</p>
                <span className="text-[11px] text-gray-400">compras en 2 años y visitas al mes</span>
              </div>
              <div className="mt-3 space-y-3">
                {CHANNEL_KEYS.map((key) => {
                  const Icon = FEATURE_ICONS[key];
                  const { max, median } = metadata.feature_stats[key];
                  const val = features[key] || 0;
                  const ratio = Math.min(1, val / (max || 1));
                  return (
                    <div key={key} className="grid grid-cols-[1.25rem_6.5rem_1fr_auto] items-center gap-3" title={metadata.feature_info[key].label}>
                      <Icon className="w-4 h-4 text-brand-500" aria-hidden="true" />
                      <span className="text-sm text-gray-700 truncate">{SHORT_LABELS[key]}</span>
                      <div className="relative h-2.5 rounded-full bg-surface-subtle">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(ratio * 100, 3)}%`, background: `linear-gradient(to right, ${accent}, #FF9161)` }} />
                        <span className="absolute -top-1 w-0.5 h-[18px] bg-gray-400/70" style={{ left: `${(median / (max || 1)) * 100}%` }}
                          title="Cliente típico" aria-hidden="true" />
                      </div>
                      <Stepper
                        compact
                        label={SHORT_LABELS[key]}
                        value={val}
                        step={1}
                        onChange={(v) => handleInputChange(key, v)}
                        onBump={(d) => handleBump(key, d)}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">La línea gris marca el valor del cliente típico.</p>
            </div>
          </aside>

          {/*Formulario en tres partes*/}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-6 border-b border-surface-border" role="tablist">
              {groups.map(({ group }, i) => (
                <button
                  key={group}
                  role="tab"
                  aria-selected={activeGroup === group}
                  onClick={() => setActiveGroup(group)}
                  className={`${underlineTab(activeGroup === group)} -mb-px pt-1`}
                >
                  <span className="font-mono text-xs mr-1.5 text-brand-400">{i + 1}</span>
                  {group}
                </button>
              ))}
            </div>

            {groups.map(({ group, features: keys }) => (
              <div key={group} role="tabpanel" hidden={activeGroup !== group} className="pt-6">
                <h3 className="font-display font-bold text-xl text-gray-900">{GROUP_META[group]?.title ?? group}</h3>
                <p className="text-sm text-gray-500">{GROUP_META[group]?.hint}</p>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {keys.map((key) => {
                    const info = metadata.feature_info[key];
                    const stats = metadata.feature_stats[key];
                    const val = features[key] ?? stats.median;
                    const Icon = FEATURE_ICONS[key];
                    const span = stats.max - stats.min || 1;
                    const pct = ((Math.min(Math.max(val, stats.min), stats.max) - stats.min) / span) * 100;
                    const medianPct = ((stats.median - stats.min) / span) * 100;
                    const hint = typicalHint(val, stats.median);
                    const label = SHORT_LABELS[key] ?? info.label;
                    return (
                      <div key={key} className="p-4 rounded-xl bg-white border border-surface-border hover:border-brand-200 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <label htmlFor={key} className="flex items-center gap-2.5 min-w-0" title={info.label}>
                            <span className="w-9 h-9 shrink-0 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                              {Icon && <Icon className="w-4 h-4" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900 truncate">{label}</span>
                              <span id={`${key}-hint`} className={`block text-[11px] ${hint === 'Típico' ? 'text-gray-400' : 'text-brand-600 font-semibold'}`}>
                                {hint}
                              </span>
                            </span>
                          </label>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-400">{info.unit || 'cantidad'}</span>
                          <Stepper
                            id={key}
                            label={label}
                            value={val}
                            step={info.step}
                            onChange={(v) => handleInputChange(key, v)}
                            onBump={(d) => handleBump(key, d)}
                            describedBy={`${key}-hint`}
                          />
                        </div>

                        <div className="relative mt-3">
                          <input
                            type="range"
                            aria-label={`${info.label} (control deslizante)`}
                            min={stats.min}
                            max={stats.max}
                            step={info.step}
                            value={val}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            className="slider w-full block"
                            style={{ '--pct': `${pct}%` }}
                          />
                          <span
                            className="pointer-events-none absolute -top-[5px] w-0.5 h-4 bg-gray-400/70"
                            style={{ left: `calc(${medianPct}% + ${8 - medianPct * 0.18}px)` }}
                            title="Cliente típico"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[10px] text-gray-400 font-mono">
                          <span>{formatValue(key, stats.min)}</span>
                          <span>típico {formatValue(key, stats.median)}</span>
                          <span>{formatValue(key, stats.max)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {nextGroup && (
                  <button
                    onClick={() => setActiveGroup(nextGroup.group)}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Continuar con {GROUP_META[nextGroup.group]?.title.toLowerCase()} <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/*Modelo y botón principal*/}
            <div className="mt-8 pt-6 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="model-select" className="text-sm text-gray-500">Modelo</label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-sm font-semibold bg-transparent border-b border-surface-border py-1 pr-1 text-gray-800 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">K-Means + detección de atípicos</option>
                  <option value="kmeans">Solo K-Means</option>
                  <option value="dbscan">Solo DBSCAN</option>
                </select>
              </div>

              {isStale && (
                <p className="text-xs text-amber-800 sm:max-w-[14rem] sm:text-right" role="status">
                  El perfil cambió. Se debe pulsar el botón para recalcular el segmento.
                </p>
              )}
              <button onClick={handleExecute} disabled={loading}
                className={`btn-primary shrink-0 whitespace-nowrap px-7 py-3 text-sm ${isStale ? 'ring-4 ring-amber-200' : ''}`}>
                <Wand2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Asignando segmento...' : 'Asignar Segmento'}</span>
              </button>
            </div>

            {error && (
              <p className="mt-4 pl-3 border-l-2 border-red-500 text-red-800 text-sm">{error}</p>
            )}
          </div>
        </div>
      </section>

      {/*Paso 2, resultado*/}
      <section ref={resultRef} className="mt-16 pt-10 border-t border-surface-border scroll-mt-20">
        <StepHeading n={2} title="A qué grupo pertenece" />

        {!prediction ? (
          <div className="mt-6 max-w-xl">
            <p className="font-semibold text-gray-900">Esperando Ejecución</p>
            <p className="mt-1 text-sm text-gray-500">
              Cuando el perfil esté listo, el botón <strong>Asignar Segmento</strong> muestra el grupo del cliente y la campaña que le conviene.
            </p>
          </div>
        ) : (
          <>
          {isStale && (
            <p className="mt-6 py-2.5 pl-3 border-l-4 border-amber-400 text-sm text-amber-800" role="status">
              Este resultado corresponde al perfil anterior. Al pulsar <strong>Asignar Segmento</strong> se recalcula con los valores nuevos.
            </p>
          )}
          <div key={runId} className={`mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 animate-fade-up transition-opacity ${isStale ? 'opacity-40' : ''}`}>
            <div className="lg:col-span-7">
              <p className="text-xs font-mono text-gray-500">
                {prediction.is_noise ? 'Sin cluster (ruido)' : `Cluster ${prediction.cluster_id}`} · {prediction.active_model_name}
              </p>
              <h3 className="mt-1 font-display font-bold text-4xl sm:text-5xl leading-tight" style={{ color: prediction.color }}
                data-testid="segment-name">
                {prediction.segment_name}
              </h3>
              <p className="mt-3 text-base text-gray-600 leading-relaxed">{prediction.description}</p>

              <blockquote className="mt-6 pl-5 border-l-4" style={{ borderColor: prediction.color }}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Estrategia recomendada</p>
                <p className="mt-1.5 font-display text-xl text-gray-900 leading-snug">{prediction.recommendation}</p>
              </blockquote>

              {outlier && (
                <p className={`mt-6 flex gap-2.5 text-sm leading-relaxed ${outlier.is_outlier ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {outlier.is_outlier
                    ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>
                    <span className="font-semibold">{outlier.is_outlier ? 'Cliente atípico' : 'Cliente típico'}</span>
                    <span className="text-gray-600"> · {outlier.message}</span>
                    <span className="block text-[11px] text-gray-400 font-mono">
                      Distancia al core más cercano {outlier.distance_to_core.toFixed(3)} · eps {outlier.eps}
                    </span>
                  </span>
                </p>
              )}

              {prediction.out_of_range_features?.length > 0 && (
                <p className="mt-4 pl-3 border-l-2 border-amber-400 text-amber-800 text-sm">
                  Hay valores fuera del rango del entrenamiento en{' '}
                  {prediction.out_of_range_features.map((f) => metadata.feature_info[f]?.label ?? f).join(', ')},
                  por lo que el resultado puede ser menos confiable.
                </p>
              )}
            </div>

            <div className="lg:col-span-5 space-y-8">
              {membership && (
                <div className="space-y-2.5">
                  <p className="text-sm font-bold text-gray-900">Afinidad con cada segmento (K-Means)</p>
                  {segments.map((s) => {
                    const value = membership[String(s.id)] ?? 0;
                    return (
                      <div key={s.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.5rem] items-center gap-3 text-sm">
                        <span className="text-gray-700 truncate" title={s.name}>{s.short_name}</span>
                        <div className="h-2 bg-surface-subtle">
                          <div className="h-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="font-mono text-right text-gray-900 tabular-nums">{pctValue(value)}</span>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Se calcula con la distancia a cada centroide. Indica qué tan cerca está el cliente de cada grupo y no es una probabilidad.
                  </p>
                </div>
              )}

              {prediction.multi_model_summary && (
                <div>
                  <p className="text-sm font-bold text-gray-900">Resultado de cada modelo</p>
                  <dl className="mt-2 divide-y divide-surface-border">
                    {Object.values(prediction.multi_model_summary).map((r) => (
                      <div key={r.model_id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <dt className="flex items-center gap-2 text-gray-500">
                          <span className="w-1 h-4" style={{ backgroundColor: r.color }} aria-hidden="true" />
                          {r.short_name}
                        </dt>
                        <dd className="text-right">
                          <span className="font-semibold text-gray-900">{r.segment_short_name}</span>
                          <span className="ml-2 text-[11px] text-gray-400 font-mono">
                            {r.is_noise ? 'ruido' : `cluster ${r.cluster_id}`} · d={r.distance.toFixed(2)}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {prediction.top_deviations?.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-900">Variables en las que más se aleja de su segmento</p>
                  <ul className="mt-2 divide-y divide-surface-border">
                    {prediction.top_deviations.slice(0, 5).map((d) => {
                      const Icon = FEATURE_ICONS[d.feature];
                      const up = d.deviation_z > 0;
                      return (
                        <li key={d.feature} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-gray-700 min-w-0">
                            {Icon && <Icon className="w-4 h-4 shrink-0 text-gray-400" />}
                            <span className="truncate">{d.label}</span>
                            <span className="text-[11px] text-gray-400 shrink-0">{num(d.value, 2)} vs {num(d.segment_mean, 2)}</span>
                          </span>
                          <span className={`font-mono text-xs font-semibold shrink-0 ${up ? 'text-brand-700' : 'text-amber-700'}`}>
                            {up ? `↑ +${d.deviation_z} σ` : `↓ ${d.deviation_z} σ`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </section>

      {/*Paso 3, mapa y comparación*/}
      <section className="mt-16 pt-10 border-t border-surface-border">
        <StepHeading n={3} title="Dónde está entre los demás clientes">
          Cada punto es un cliente real. Las 15 variables se resumen en 2 componentes que explican el{' '}
          {pctValue(metadata.pca.total_explained_variance * 100)} de la varianza.
        </StepHeading>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-900">Mapa de Clientes (PCA 2D)</p>
              <div className="inline-flex gap-5">
                <button onClick={() => setMapModel('kmeans')} aria-pressed={mapModel === 'kmeans'} className={underlineTab(mapModel === 'kmeans')}>
                  K-Means
                </button>
                <button onClick={() => setMapModel('dbscan')} aria-pressed={mapModel === 'dbscan'} className={underlineTab(mapModel === 'dbscan')}>
                  DBSCAN
                </button>
              </div>
            </div>
            <div className="mt-4">
              <PcaScatter
                points={points}
                model={mapModel}
                metadata={metadata}
                star={prediction && !isStale ? { ...prediction.pca, color: prediction.color } : null}
              />
            </div>
          </div>

          <details className="lg:col-span-5 group" open={Boolean(prediction?.comparison)}>
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
              <span>
                <span className="block text-sm font-bold text-gray-900">Cliente frente a su segmento</span>
                <span className="block text-xs text-gray-500">Cada variable frente al promedio de su segmento y de todo el dataset.</span>
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0" />
            </summary>

            {!prediction?.comparison ? (
              <p className="py-8 text-sm text-gray-400">La comparación aparece después de asignar un segmento.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-2 text-left font-semibold">Variable</th>
                      <th className="py-2 px-2 text-right font-semibold">Cliente</th>
                      <th className="py-2 px-2 text-right font-semibold">Segmento</th>
                      <th className="py-2 pl-2 text-right font-semibold">Global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metadata.features.filter((f) => prediction.comparison[f]).map((f) => {
                      const c = prediction.comparison[f];
                      return (
                        <tr key={f} className="border-b border-surface-border/70">
                          <td className="py-1.5 pr-2 text-gray-700">{SHORT_LABELS[f] ?? metadata.feature_info[f].label}</td>
                          <td className={`py-1.5 px-2 text-right font-mono tabular-nums font-semibold ${
                            c.is_out_of_range ? 'text-amber-700' : c.is_above_segment ? 'text-brand-700' : 'text-gray-900'
                          }`}>
                            {num(c.value, 2)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-gray-600">{num(c.segment_mean, 2)}</td>
                          <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-gray-400">{num(c.global_mean, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </div>
      </section>
    </div>
  );
}
