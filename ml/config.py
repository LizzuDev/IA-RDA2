"""Configuración general del entrenamiento de los modelos de clustering."""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT_DIR / "data" / "marketing_campaign.csv"
ARTIFACTS_DIR = ROOT_DIR / "backend" / "artifacts"

RANDOM_STATE = 42

#Año de referencia para calcular la edad, ya que el último registro de cliente es de 2014
REFERENCE_YEAR = 2014

#Límites para descartar errores de captura encontrados en el EDA
MAX_AGE = 100
MAX_INCOME = 200_000

#Variables numéricas que entran al modelo, en este orden
FEATURES = [
    "Income", "Age", "Children", "Recency",
    "MntWines", "MntFruits", "MntMeatProducts", "MntFishProducts", "MntSweetProducts", "MntGoldProds",
    "NumDealsPurchases", "NumWebPurchases", "NumCatalogPurchases", "NumStorePurchases", "NumWebVisitsMonth",
]
SPENDING = ["MntWines", "MntFruits", "MntMeatProducts", "MntFishProducts", "MntSweetProducts", "MntGoldProds"]
PURCHASES = ["NumWebPurchases", "NumCatalogPurchases", "NumStorePurchases"]

#Las variables binarias no entran al modelo, solo sirven para describir los perfiles
BINARY = ["AcceptedCmp1", "AcceptedCmp2", "AcceptedCmp3", "AcceptedCmp4", "AcceptedCmp5", "Response", "Complain"]

#Hiperparámetros elegidos en el notebook
N_COMPONENTS = 2
K_RANGE = range(2, 10)
K_OPT = 4
DBSCAN_MIN_SAMPLES = 2 * N_COMPONENTS     #regla práctica MinPts igual a 2 por D

#Cantidad de clientes reales por segmento que se ofrecen como ejemplo en la interfaz
SAMPLES_PER_SEGMENT = 2

#Etiquetas de cada variable que usa el front para construir el formulario
FEATURE_INFO = {
    "Income":              {"label": "Ingreso anual del hogar", "unit": "$",      "group": "Perfil",  "step": 1000},
    "Age":                 {"label": "Edad",                     "unit": "años",   "group": "Perfil",  "step": 1},
    "Children":            {"label": "Hijos en casa",            "unit": "",       "group": "Perfil",  "step": 1},
    "Recency":             {"label": "Días desde la última compra", "unit": "días", "group": "Perfil", "step": 1},
    "MntWines":            {"label": "Gasto en vinos",           "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "MntFruits":           {"label": "Gasto en frutas",          "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "MntMeatProducts":     {"label": "Gasto en carnes",          "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "MntFishProducts":     {"label": "Gasto en pescado",         "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "MntSweetProducts":    {"label": "Gasto en dulces",          "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "MntGoldProds":        {"label": "Gasto en oro",             "unit": "$ en 2 años", "group": "Gasto", "step": 1},
    "NumDealsPurchases":   {"label": "Compras con descuento",    "unit": "compras", "group": "Canales", "step": 1},
    "NumWebPurchases":     {"label": "Compras por la web",       "unit": "compras", "group": "Canales", "step": 1},
    "NumCatalogPurchases": {"label": "Compras por catálogo",     "unit": "compras", "group": "Canales", "step": 1},
    "NumStorePurchases":   {"label": "Compras en tienda",        "unit": "compras", "group": "Canales", "step": 1},
    "NumWebVisitsMonth":   {"label": "Visitas web en el último mes", "unit": "visitas", "group": "Canales", "step": 1},
}

#Textos de cada segmento, se asignan a los clusters con reglas sobre el perfil promedio
SEGMENT_TEXTS = {
    "low": {
        "name": "Ahorradores de bajo ingreso",
        "short_name": "Ahorradores",
        "color": "#64748b",
        "description": "Clientes de ingreso bajo, con hijos y con un gasto mínimo en todas las categorías. "
                       "Visitan mucho la web, pero compran poco.",
        "recommendation": "Campañas de canasta básica y marca propia, junto con cupones digitales de bajo costo "
                          "en la web para convertir las visitas en compras.",
    },
    "premium": {
        "name": "Premium de alto gasto",
        "short_name": "Premium",
        "color": "#7c3aed",
        "description": "Clientes de ingreso alto, casi sin hijos y con el mayor gasto en vinos y carnes. Compran "
                       "mucho por catálogo y en tienda, casi no usan descuentos y son los que más responden a las campañas.",
        "recommendation": "Programa VIP con catálogo de vinos, carnes y pescado, preventas exclusivas y "
                          "atención personalizada, sin ofrecer descuentos.",
    },
    "deals": {
        "name": "Familias cazadoras de ofertas",
        "short_name": "Ofertas",
        "color": "#f59e0b",
        "description": "Clientes de ingreso medio, con la mayor cantidad de hijos y el mayor uso de compras con "
                       "descuento. Compran por la web y visitan mucho el sitio.",
        "recommendation": "Promociones 2x1 y paquetes familiares por correo y web, con descuentos en productos de "
                          "consumo frecuente para subir el valor de cada compra.",
    },
    "consolidated": {
        "name": "Consolidados multicanal",
        "short_name": "Consolidados",
        "color": "#0ea5e9",
        "description": "Clientes de ingreso medio alto, con menos de un hijo en promedio y un gasto alto en vinos "
                       "y oro. Compran por todos los canales, es decir, web, tienda y catálogo.",
        "recommendation": "Venta cruzada de vino con productos gourmet y beneficios por comprar en varios canales. "
                          "Son candidatos a pasar al grupo Premium con una membresía.",
    },
}
NOISE_SEGMENT = {
    "name": "Atípico (ruido)",
    "short_name": "Ruido",
    "color": "#ef4444",
    "description": "El cliente está lejos de cualquier zona densa de clientes, por eso DBSCAN no lo asigna a ningún grupo.",
    "recommendation": "Revisar el caso de forma manual, ya que puede ser un error de captura o un cliente con un "
                      "comportamiento poco común que merece atención individual.",
}
