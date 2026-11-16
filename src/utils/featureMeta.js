import {
  Apple, BadgePercent, Baby, Beef, BookOpen, Cake, CalendarClock, Candy, Fish, Gem,
  Laptop, MousePointerClick, ShoppingBag, Store, User, Wallet, Wine,
} from 'lucide-react';

//Icono de cada variable del modelo
export const FEATURE_ICONS = {
  Income: Wallet,
  Age: Cake,
  Children: Baby,
  Recency: CalendarClock,
  MntWines: Wine,
  MntFruits: Apple,
  MntMeatProducts: Beef,
  MntFishProducts: Fish,
  MntSweetProducts: Candy,
  MntGoldProds: Gem,
  NumDealsPurchases: BadgePercent,
  NumWebPurchases: Laptop,
  NumCatalogPurchases: BookOpen,
  NumStorePurchases: Store,
  NumWebVisitsMonth: MousePointerClick,
};

//Grupos del formulario con su icono, un título corto y una breve guía
export const GROUP_META = {
  Perfil: { icon: User, title: 'Quién es', hint: 'Edad, hogar, ingresos y cuándo compró por última vez.' },
  Gasto: { icon: ShoppingBag, title: 'Qué compra', hint: 'Cuánto gastó en cada categoría en los últimos 2 años.' },
  Canales: { icon: MousePointerClick, title: 'Dónde compra', hint: 'Cuántas compras hizo por cada canal.' },
};

//Nombres cortos para los controles, las etiquetas completas vienen de la API
export const SHORT_LABELS = {
  Income: 'Ingreso anual',
  Age: 'Edad',
  Children: 'Hijos en casa',
  Recency: 'Última compra',
  MntWines: 'Vinos',
  MntFruits: 'Frutas',
  MntMeatProducts: 'Carnes',
  MntFishProducts: 'Pescado',
  MntSweetProducts: 'Dulces',
  MntGoldProds: 'Oro y joyas',
  NumDealsPurchases: 'Con descuento',
  NumWebPurchases: 'Web',
  NumCatalogPurchases: 'Catálogo',
  NumStorePurchases: 'Tienda física',
  NumWebVisitsMonth: 'Visitas web / mes',
};

export const SPEND_KEYS = [
  'MntWines', 'MntFruits', 'MntMeatProducts', 'MntFishProducts', 'MntSweetProducts', 'MntGoldProds',
];

export const CHANNEL_KEYS = [
  'NumWebPurchases', 'NumCatalogPurchases', 'NumStorePurchases', 'NumDealsPurchases', 'NumWebVisitsMonth',
];

//Rasgos del cliente que se leen a partir de sus variables, hasta un máximo de limit
//Cada rasgo completa la frase que empieza con Cliente
export function personaTraits(f, limit = 4) {
  const traits = [];
  const add = (cond, label) => { if (cond) traits.push(label); };
  const spent = SPEND_KEYS.reduce((acc, k) => acc + (f[k] || 0), 0);
  add(f.Income >= 75000, 'con alto poder adquisitivo');
  add(f.MntWines >= 450, 'amante del vino');
  add(f.MntMeatProducts >= 350, 'que gasta mucho en carnes');
  add(f.NumDealsPurchases >= 5, 'que busca ofertas');
  add(f.NumCatalogPurchases >= 5, 'que compra por catálogo');
  add(f.NumWebPurchases >= 7 || f.NumWebVisitsMonth >= 8, 'muy activo en la web');
  add(f.NumStorePurchases >= 9, 'fiel a la tienda física');
  add(f.MntGoldProds >= 100, 'interesado en joyas y oro');
  add(f.Children >= 2, 'con familia numerosa');
  add(f.Recency <= 14, 'con una compra reciente');
  add(f.Recency >= 75, 'en riesgo de abandono');
  add(f.Income > 0 && f.Income < 32000, 'con presupuesto ajustado');
  add(spent < 120, 'de gasto bajo');
  return traits.slice(0, limit);
}
