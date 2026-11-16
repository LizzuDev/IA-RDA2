import { useId } from 'react';
import { FEATURE_ICONS, SHORT_LABELS, SPEND_KEYS } from '../utils/featureMeta';
import { num } from '../utils/format';

const SKIN = '#F2C4A0';
const SKIN_SHADE = '#E0A57E';
const INK = '#2A2233';
const KID_COLORS = ['#38BDF8', '#FBBF24', '#34D399'];
const KID_SKIN = ['#F2C4A0', '#E6B48E', '#F6D1B3'];

//Posición de las burbujas de gasto alrededor de la cabeza, en porcentaje del contenedor
const ORBIT = [
  { x: 13, y: 27 }, { x: 19, y: 8 }, { x: 38, y: -2 }, { x: 62, y: -2 }, { x: 81, y: 8 }, { x: 87, y: 27 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hairColor(age) {
  if (age >= 65) return '#E4E0E8';
  if (age >= 55) return '#A9A3B0';
  if (age >= 40) return '#5A3D30';
  return '#33221C';
}

function incomeTier(income) {
  if (income >= 70000) return 'high';
  if (income >= 40000) return 'mid';
  return 'low';
}

//Cabello según la edad, con volumen, peinado de lado o con entradas
function Hair({ age, color }) {
  if (age >= 55) {
    return (
      <g fill={color}>
        <path d="M109 98 C106 76 112 62 124 57 C120 70 118 82 117 96 Z" />
        <path d="M171 98 C174 76 168 62 156 57 C160 70 162 82 163 96 Z" />
        <path d="M124 57 C134 52 146 52 156 57 C150 56 130 56 124 57 Z" />
      </g>
    );
  }
  if (age >= 35) {
    return (
      <path fill={color}
        d="M109 94 C106 64 122 50 141 50 C160 50 175 62 172 94 C169 80 162 70 150 66 C138 72 122 74 112 80 C110 84 109 88 109 94 Z" />
    );
  }
  return (
    <path fill={color}
      d="M107 96 C100 62 120 42 143 44 C166 45 180 62 173 96 C170 82 165 74 158 70 C150 76 134 78 120 74 C114 80 109 88 107 96 Z M120 48 C126 38 140 36 150 42 C140 42 128 44 120 48 Z" />
  );
}

//Niño de medio cuerpo dibujado con las mismas formas que el adulto
function Kid({ x, i }) {
  const top = 262;
  return (
    <g className="animate-float" style={{ animationDelay: `${i * 0.7}s`, transformBox: 'fill-box' }}>
      <path
        d={`M${x - 17} 320 L${x - 16} ${top + 34} C${x - 15} ${top + 24} ${x - 8} ${top + 20} ${x} ${top + 20} C${x + 8} ${top + 20} ${x + 15} ${top + 24} ${x + 16} ${top + 34} L${x + 17} 320 Z`}
        style={{ fill: KID_COLORS[i] }}
      />
      <path d={`M${x - 6} ${top + 20} Q${x} ${top + 26} ${x + 6} ${top + 20}`} stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2" fill="none" />
      <ellipse cx={x} cy={top + 4} rx={12} ry={13} fill={KID_SKIN[i]} />
      <path d={`M${x - 12} ${top + 2} C${x - 12} ${top - 12} ${x + 12} ${top - 12} ${x + 12} ${top + 2} C${x + 6} ${top - 5} ${x - 4} ${top - 5} ${x - 12} ${top + 2} Z`} fill="#3A2620" />
      <circle cx={x - 4} cy={top + 5} r={1.6} fill={INK} />
      <circle cx={x + 4} cy={top + 5} r={1.6} fill={INK} />
      <path d={`M${x - 4} ${top + 10} Q${x} ${top + 13} ${x + 4} ${top + 10}`} stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </g>
  );
}

//Ilustración del cliente que cambia con sus variables
//La edad cambia el cabello, los lentes y las arrugas, el ingreso cambia la ropa y los hijos aparecen a su lado
//La última compra cambia la sonrisa, el gasto cambia las burbujas y la bolsa, y el color es el del segmento
export default function Persona({ features, metadata, accent = '#F0357F', compact = false, showBubbles = true, decorative = false }) {
  const f = features;
  const age = f.Age ?? 44;
  const tier = incomeTier(f.Income ?? 0);
  const kids = clamp(Math.round(f.Children ?? 0), 0, 3);
  const smile = 1 + 8 * (1 - clamp((f.Recency ?? 50) / 99, 0, 1));
  const spent = SPEND_KEYS.reduce((acc, k) => acc + (f[k] || 0), 0);
  const bag = 0.65 + 0.75 * clamp(Math.sqrt(spent / 2500), 0, 1);
  const hair = hairColor(age);
  const cloth = { fill: accent, transition: 'fill 0.6s ease' };
  const kidX = [34, 250, 58];
  //Cada ilustración usa ids propios para que varias en la misma página no compartan degradados
  const id = useId().replace(/:/g, '');

  return (
    <div className={`relative mx-auto ${compact ? 'w-full max-w-[180px]' : 'w-full max-w-[320px]'}`}>
      <svg viewBox="0 0 280 320" className="w-full h-auto overflow-visible"
        {...(decorative
          ? { 'aria-hidden': true }
          : { role: 'img', 'aria-label': `Ilustración del cliente de ${Math.round(age)} años con ${kids} ${kids === 1 ? 'hijo' : 'hijos'}` })}>
        <defs>
          <radialGradient id={`halo-${id}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`torso-${id}`}>
            <path d="M98 162 C104 150 120 144 140 144 C160 144 176 150 182 162 L190 320 L90 320 Z" />
          </clipPath>
        </defs>
        <circle cx="140" cy="160" r="150" fill={`url(#halo-${id})`} />

        {/*Brazos detrás del torso*/}
        <path d="M100 158 C86 162 78 176 76 198 L70 262 L90 264 L98 208 Z" style={cloth} />
        <path d="M180 158 C194 162 202 176 204 198 L210 262 L190 264 L182 208 Z" style={cloth} />
        <path d="M100 158 C86 162 78 176 76 198 L70 262 L90 264 L98 208 Z" fill={INK} fillOpacity="0.10" />
        <path d="M180 158 C194 162 202 176 204 198 L210 262 L190 264 L182 208 Z" fill={INK} fillOpacity="0.16" />

        {/*Cuello y torso*/}
        <path d="M128 116 L128 140 Q140 150 152 140 L152 116 Z" fill={SKIN_SHADE} />
        <path d="M98 162 C104 150 120 144 140 144 C160 144 176 150 182 162 L190 320 L90 320 Z" style={cloth} />
        <rect x="140" y="140" width="60" height="180" fill={INK} fillOpacity="0.06" clipPath={`url(#torso-${id})`} />

        {tier === 'low' && (
          <g>
            {/*Sudadera con cuello redondo, cordones y bolsillo*/}
            <path d="M124 146 Q140 160 156 146" stroke={INK} strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M133 156 L131 186" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M147 156 L149 186" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M114 262 L166 262 L172 300 L108 300 Z" fill={INK} fillOpacity="0.10" />
          </g>
        )}
        {tier === 'mid' && (
          <g>
            {/*Camisa con cuello y botones*/}
            <path d="M122 148 L140 172 L132 178 L116 156 Z" fill="#FFFFFF" />
            <path d="M158 148 L140 172 L148 178 L164 156 Z" fill="#FFFFFF" />
            <line x1="140" y1="172" x2="140" y2="320" stroke={INK} strokeOpacity="0.15" strokeWidth="1.5" />
            {[192, 220, 248, 276].map((y) => <circle key={y} cx="144" cy={y} r="2.2" fill="#FFFFFF" />)}
            <path d="M160 188 L176 188 L176 202 L160 202 Z" fill={INK} fillOpacity="0.08" />
          </g>
        )}
        {tier === 'high' && (
          <g>
            {/*Saco con camisa blanca, corbata y solapas*/}
            <path d="M122 148 L140 206 L158 148 Q140 156 122 148 Z" fill="#FFFFFF" />
            <path d="M136 156 L144 156 L146 166 L142 170 L138 170 L134 166 Z" fill={INK} />
            <path d="M138 170 L142 170 L147 200 L140 208 L133 200 Z" fill={INK} />
            <path d="M120 148 L106 166 L120 176 L114 186 L140 222 L124 158 Z" fill={INK} fillOpacity="0.30" />
            <path d="M160 148 L174 166 L160 176 L166 186 L140 222 L156 158 Z" fill={INK} fillOpacity="0.30" />
            <path d="M160 196 L174 194 L172 198 L160 200 Z" fill="#FFFFFF" />
            <circle cx="140" cy="244" r="2.4" fill={INK} fillOpacity="0.4" />
          </g>
        )}

        {/*Manos*/}
        <ellipse cx="80" cy="268" rx="9" ry="10" fill={SKIN} />
        <ellipse cx="200" cy="268" rx="9" ry="10" fill={SKIN} />

        {/*Bolsa de compras en la mano derecha, crece con el gasto total*/}
        <g style={{ transform: `translate(200px, 270px) scale(${bag})`, transition: 'transform 0.5s ease' }}>
          <path d="M-10 6 C-10 -10 10 -10 10 6" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M-20 6 L20 6 L24 52 L-24 52 Z" fill="#FF7340" />
          <path d="M-20 6 L20 6 L21 16 L-21 16 Z" fill="#FFFFFF" fillOpacity="0.25" />
        </g>
        <ellipse cx="200" cy="266" rx="9" ry="7" fill={SKIN} />

        {/*Cabeza*/}
        <ellipse cx="107" cy="96" rx="6" ry="9" fill={SKIN_SHADE} />
        <ellipse cx="173" cy="96" rx="6" ry="9" fill={SKIN_SHADE} />
        <ellipse cx="140" cy="88" rx="32" ry="37" fill={SKIN} />
        <Hair age={age} color={hair} />

        {/*Cara*/}
        <path d="M120 82 Q127 78 134 82" stroke={age >= 55 ? '#8E8794' : INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M146 82 Q153 78 160 82" stroke={age >= 55 ? '#8E8794' : INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <ellipse cx="127" cy="92" rx="3" ry="3.6" fill={INK} />
        <ellipse cx="153" cy="92" rx="3" ry="3.6" fill={INK} />
        <path d="M140 95 Q136 104 141 106" stroke={SKIN_SHADE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="119" cy="104" r="5" fill="#FB7185" fillOpacity="0.28" />
        <circle cx="161" cy="104" r="5" fill="#FB7185" fillOpacity="0.28" />
        <path d={`M129 112 Q140 ${112 + smile} 151 112`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        {age >= 50 && (
          <g stroke={INK} strokeWidth="2" fill="#FFFFFF" fillOpacity="0.15">
            <rect x="117" y="84" width="20" height="15" rx="6" />
            <rect x="143" y="84" width="20" height="15" rx="6" />
            <line x1="137" y1="90" x2="143" y2="90" />
          </g>
        )}
        {age >= 58 && (
          <g stroke={INK} strokeOpacity="0.22" strokeWidth="1.4" fill="none" strokeLinecap="round">
            <path d="M130 68 Q140 65 150 68" />
            <path d="M112 100 Q114 104 112 108" />
            <path d="M168 100 Q166 104 168 108" />
          </g>
        )}

        {/*Hijos*/}
        {Array.from({ length: kids }, (_, i) => <Kid key={i} x={kidX[i]} i={i} />)}
      </svg>

      {/*Burbujas de gasto por categoría*/}
      {showBubbles && metadata && SPEND_KEYS.map((key, i) => {
        const Icon = FEATURE_ICONS[key];
        const max = metadata.feature_stats[key].max || 1;
        const ratio = clamp(Math.sqrt((f[key] || 0) / max), 0, 1);
        const size = (compact ? 16 : 24) + ratio * (compact ? 18 : 32);
        const pos = ORBIT[i];
        return (
          <div
            key={key}
            title={`${SHORT_LABELS[key]} $${num(f[key] || 0)}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white shadow-card transition-all duration-500"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: size, height: size, opacity: 0.3 + ratio * 0.7 }}
          >
            <span className="animate-float flex" style={{ animationDelay: `${i * 0.4}s` }}>
              <Icon style={{ width: size * 0.5, height: size * 0.5, color: accent }} aria-hidden="true" />
            </span>
          </div>
        );
      })}
    </div>
  );
}
