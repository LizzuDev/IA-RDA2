import { ArrowRight, Crown, Megaphone, Radar, Target } from 'lucide-react';
import { MODEL_COMPARISON, METADATA } from '../services/api';
import { num, pct, pctValue, primaryModel, segmentList } from '../utils/format';
import Persona from './Persona';

const primary = primaryModel(MODEL_COMPARISON);
const dbscan = MODEL_COMPARISON.models.find((m) => m.id === 'dbscan');
const segments = segmentList(METADATA);
const byKey = Object.fromEntries(segments.map((s) => [s.key, s]));
const { premium, low, deals } = byKey;

//Cada uso trae un dato real del dataset para que se entienda la diferencia entre grupos
const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Personalizar campañas',
    stat: `${pct(premium.binary_rates.Response, 0)} vs ${pct(low.binary_rates.Response, 0)}`,
    color: premium.color,
    desc: `El ${pct(premium.binary_rates.Response, 0)} de los clientes Premium respondió a la última campaña, frente al
      ${pct(low.binary_rates.Response, 0)} de los Ahorradores. Enviar la misma campaña a todos los clientes desperdicia presupuesto.`,
  },
  {
    icon: Crown,
    title: 'Cuidar a los que más gastan',
    stat: `${Math.round(premium.means.TotalSpent / low.means.TotalSpent)}×`,
    color: premium.color,
    desc: `En dos años un cliente Premium gasta en promedio $${num(premium.means.TotalSpent)}, mientras que un Ahorrador gasta
      $${num(low.means.TotalSpent)}. Por esa diferencia conviene ofrecerles preventas y una atención exclusiva.`,
  },
  {
    icon: Target,
    title: 'Elegir el canal y el mensaje',
    stat: `${num(deals.means.NumDealsPurchases, 0)} vs ${num(premium.means.NumDealsPurchases, 0)}`,
    color: deals.color,
    desc: `Las familias cazadoras de ofertas realizan ${num(deals.means.NumDealsPurchases, 1)} compras con descuento y los
      clientes Premium solo ${num(premium.means.NumDealsPurchases, 1)}. Al primer grupo le convienen las promociones y al segundo no.`,
  },
  {
    icon: Radar,
    title: 'Detectar lo inusual',
    stat: pctValue(dbscan.metrics.noise_pct, 2),
    color: '#ef4444',
    desc: `DBSCAN identifica ${dbscan.metrics.noise_count} clientes que no se parecen a ningún grupo. Es recomendable
      revisarlos por separado antes de incluirlos en una campaña.`,
  },
];

const STEPS = [
  { title: 'Describe', desc: 'Se registra el perfil del cliente con sus datos, lo que compra y los canales que utiliza. El punto de partida es el cliente típico.' },
  { title: 'Agrupa', desc: 'K-Means asigna al cliente el segmento más parecido y DBSCAN revisa si se trata de un cliente atípico.' },
  { title: 'Actúa', desc: 'Se obtiene la estrategia de marketing recomendada y las diferencias del cliente con su grupo.' },
];

export default function LandingHero({ onStartTool, onGoToMetrics }) {
  const metrics = [
    { value: String(primary.metrics.n_clusters), label: 'segmentos de clientes listos para campañas' },
    { value: num(MODEL_COMPARISON.dataset.total), label: 'clientes reales analizados' },
    { value: primary.metrics.silhouette.toFixed(3), label: 'coeficiente Silhouette, indica qué tan separados están los grupos' },
  ];

  return (
    <div className="relative overflow-hidden">
      {/*Manchas de color animadas detrás del hero*/}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[760px]">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-brand-200/60 blur-3xl animate-blob" />
        <div className="absolute top-10 right-0 w-[380px] h-[380px] rounded-full bg-coral-300/40 blur-3xl animate-blob" style={{ animationDelay: '-5s' }} />
        <div className="absolute top-[340px] left-1/3 w-[320px] h-[320px] rounded-full bg-violet-200/50 blur-3xl animate-blob" style={{ animationDelay: '-9s' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/*Hero*/}
        <section className="pt-14 sm:pt-20 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
              Segmentación de clientes para marketing
            </p>
            <h1 className="mt-4 font-display font-bold text-4xl sm:text-6xl text-gray-900 leading-[1.05]">
              Conocer al <span className="text-gradient">cliente</span> para lanzar la campaña correcta.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
              Segmenta AI agrupa a los clientes según su forma de comprar, es decir, cuánto ganan, en qué gastan y
              qué canales utilizan. De esta manera cada mensaje llega al grupo con mayor probabilidad de responder.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <button onClick={onStartTool} className="btn-primary px-6 py-3.5 text-sm">
                Segmentar un cliente
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onGoToMetrics}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-brand-700 transition-colors"
              >
                Cómo se eligieron los modelos
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/*Persona de muestra*/}
          <figure className="lg:col-span-5 pt-10">
            <Persona features={premium.means} metadata={METADATA} accent={premium.color} />
            <figcaption className="mt-4 text-center text-sm text-gray-500">
              Representación del cliente promedio del grupo{' '}
              <span className="font-semibold" style={{ color: premium.color }}>{premium.name}</span>.
            </figcaption>
          </figure>
        </section>

        {/*Cifras clave*/}
        <section className="grid grid-cols-1 sm:grid-cols-3 border-y border-surface-border">
          {metrics.map((m) => (
            <div key={m.label} className="py-7 sm:px-8 first:sm:pl-0 border-b sm:border-b-0 sm:border-r last:border-0 border-surface-border">
              <div className="font-display font-bold text-4xl sm:text-5xl text-gradient w-fit">{m.value}</div>
              <div className="mt-1 text-sm text-gray-500">{m.label}</div>
            </div>
          ))}
        </section>

        {/*Para qué sirve*/}
        <section className="pt-20 sm:pt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-gray-900">Para qué sirve</h2>
              <p className="mt-3 text-base text-gray-600 leading-relaxed">
                Conocer el grupo de un cliente cambia la forma de comunicarse con él, lo que se le ofrece y cuánto se
                invierte en él. Las diferencias que se presentan provienen de los mismos {num(MODEL_COMPARISON.dataset.total)} clientes.
              </p>
            </div>
          </div>

          <ol className="lg:col-span-8 divide-y divide-surface-border border-y border-surface-border">
            {USE_CASES.map(({ icon: Icon, title, stat, color, desc }) => (
              <li key={title} className="py-7 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-8 gap-y-2">
                <span className="font-display font-bold text-[1.7rem] whitespace-nowrap tabular-nums leading-none" style={{ color }}>{stat}</span>
                <div>
                  <h3 className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
                    <Icon className="w-5 h-5 text-brand-500" aria-hidden="true" />
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/*Cómo funciona*/}
        <section className="pt-20 sm:pt-24">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-gray-900">Cómo funciona</h2>
          <ol className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative card p-6">
                <span className="font-display font-bold text-5xl text-brand-100">0{i + 1}</span>
                <h3 className="mt-1 font-display font-bold text-xl text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/*Los segmentos*/}
        <section className="pt-20 sm:pt-24">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-gray-900">
            Los {segments.length} segmentos
          </h2>
          <p className="mt-2 text-base text-gray-600 max-w-2xl">
            Grupos encontrados por K-Means. Cada ilustración se construye con el promedio de su grupo.
          </p>

          <div className="mt-6 flex h-2 overflow-hidden" role="img"
            aria-label={segments.map((s) => `${s.name} ${pctValue(s.percentage)}`).join(', ')}>
            {segments.map((s) => (
              <div key={s.id} style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
            ))}
          </div>

          <div className="mt-4 divide-y divide-surface-border">
            {segments.map((s) => (
              <article key={s.id} className="py-8 grid grid-cols-[6.5rem_1fr] sm:grid-cols-[9rem_1fr] md:grid-cols-[9rem_1fr_1fr] gap-x-6 sm:gap-x-10 gap-y-3 items-start">
                <div className="row-span-2 md:row-span-1 pt-3">
                  <Persona features={s.means} metadata={METADATA} accent={s.color} compact showBubbles={false} decorative />
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold tabular-nums" style={{ color: s.color }}>
                    {pctValue(s.percentage)} · {num(s.size)} clientes
                  </p>
                  <h3 className="mt-1 font-display font-bold text-2xl text-gray-900">{s.name}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.description}</p>
                </div>
                <div className="md:pl-8 md:border-l md:border-surface-border">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>Campaña sugerida</p>
                  <p className="mt-1.5 text-sm text-gray-800 leading-relaxed">{s.recommendation}</p>
                  <p className="mt-3 text-xs text-gray-500">
                    El <span className="font-semibold text-gray-900">{pct(s.binary_rates.Response)}</span> respondió a la última campaña
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/*Por qué se usan dos modelos y aviso final*/}
        <section className="mt-12 pt-16 pb-8 border-t border-surface-border grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
          <h2 className="md:col-span-2 font-display font-bold text-2xl sm:text-3xl text-gray-900 leading-snug">
            Un modelo para segmentar, otro para detectar lo <span className="text-gradient">inusual</span>.
          </h2>
          <div className="md:col-span-3 space-y-4 text-sm text-gray-600 leading-relaxed">
            <p>
              K-Means reparte a todos los clientes en {primary.metrics.n_clusters} grupos compactos y fáciles de
              interpretar. DBSCAN agrupa por densidad y en este dataset reúne al{' '}
              {pctValue(dbscan.metrics.largest_cluster_pct)} de los clientes en un solo bloque. Por esa razón no se
              utiliza para segmentar, aunque sí permite marcar como ruido al {pctValue(dbscan.metrics.noise_pct, 2)} de
              clientes que se encuentra lejos de cualquier grupo.
            </p>
            <p className="text-gray-500">
              Herramienta con fines académicos. Los segmentos describen patrones de compra del dataset y no
              reemplazan un análisis comercial completo.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
