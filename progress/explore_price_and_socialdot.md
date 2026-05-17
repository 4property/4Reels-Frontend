# Investigación: Precio, Tipo de Listing y Bug de LinkedIn en SocialDot

Fecha: 2026-05-13

## A) PRECIO Y TIPO DE LISTING

### 1. Tipo de Listing (`kind`) - Campo EXISTS
**File: `/opt/projects/4Reels-Frontend/src/features/reels/hooks.js:102`**
```javascript
kind: classifyKind(item.property_status),
```

El campo `kind` existe y se clasifica desde `item.property_status` (del backend).

**Valores válidos** (según `KindBadge.jsx:1-8`):
- `'for-sale'` → "For sale"
- `'sale-agreed'` → "Sale agreed"
- `'sold'` → "Sold"
- `'to-let'` → "To let"
- `'let-agreed'` → "Let agreed"
- `'let'` → "Let"

**Lógica de clasificación** (`hooks.js:119-127`):
- Si contiene "let" → `'let-agreed'` o `'to-let'` (alquiler)
- Si contiene "rent" o es "to_let" → `'to-let'` (alquiler)
- Si contiene "sale agreed" → `'sale-agreed'` (venta)
- Si es "sold" → `'sold'` (venta)
- Default → `'for-sale'` (venta)

**Conclusión**: Existe campo implícito que distingue venta vs alquiler a través de `kind`, pero NO existe campo booleano `isRental`/`forRent`/`listingType`. El discriminador es el contenido de `property_status` del backend.

---

### 2. Tipo y formato de `price`

**Type**: `string` (no hay validación de número)

**Location**: `hooks.js:92`
```javascript
price: item.price || '',
```

**Rendering**: `ReelCard.jsx:50`
```jsx
{reel.price ? <div className="reel-card-price">{reel.price}</div> : null}
```

**Ejemplo de valor** (test real, `flows.spec.js:76`):
```
price: '€385,000'
```

El precio se renderiza **tal cual**, sin transformación en el front.

---

### 3. Helpers de formato de precio en el repo

**SI EXISTEN**, pero son para PRESETS / configuración, NO para reels en vivo:

1. **`formatPriceSample()` en `/opt/projects/4Reels-Frontend/src/features/defaults/formatter.js:5-17`**
   - Usado en `LivePreview.jsx` para mostrar vista previa de configuración de precio
   - **No se usa en ReelCard / ReelsTable**
   - Aplica: currency symbol, thousandsSep, currencyPosition

2. **Valores en `initialState.js:35-41`** (defaults globales):
   ```javascript
   currency: 'EUR',
   currencyPosition: 'prefix',
   thousandsSep: ',',
   decimalSep: '.',
   priceRounding: 'exact',
   ```

**Conclusión**: 
- El precio de `reel.price` es string plano sin transformación en el front
- `formatPriceSample()` existe pero es solo para el panel de configuración
- Recomendación: Si necesitas formatear precios vivos, deberías usar lógica similar a `formatPriceSample()` con los valores de defaults

---

## B) BUG DE LINKEDIN EN SOCIALDOT / NETWORKS

### 1. IDs que devuelve `useSocials()` (TenantProvider.jsx)

**Location**: `/opt/projects/4Reels-Frontend/src/app/providers/TenantProvider.jsx`

**Orden deseado** (`adaptSocialAccounts()` líneas 125-133):
```javascript
const desiredOrder = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'linkedin',      // ← LINKEDIN ESTÁ AQUÍ
  'gbp',
  'pinterest',
];
```

**Valores de `id` retornados** (línea 155):
```javascript
id: platform,  // lowercase string, e.g., 'linkedin'
```

**Preset de LinkedIn** (línea 41):
```javascript
linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
```

**Conclusión**: `useSocials()` devuelve `{ id: 'linkedin', name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', ... }` en minúsculas y coincide con preset.

---

### 2. IDs que guarda `reel.networks`

**Location**: `/opt/projects/4Reels-Frontend/src/features/reels/hooks.js:114-117`

```javascript
function parseNetworksFromPipeline(workflowState, publishStatus) {
  if (publishStatus === 'published') return ['instagram', 'tiktok', 'facebook'];
  return [];
}
```

**PROBLEMA CRÍTICO**:
- `parseNetworksFromPipeline()` devuelve hardcoded: `['instagram', 'tiktok', 'facebook']`
- **LinkedIn NO está en esta lista**
- Esto significa que aunque LinkedIn esté conectado en el agency, **nunca aparecerá en un reel publicado**

---

### 3. Mapeo de IDs en ReelCard.jsx

**Location**: `/opt/projects/4Reels-Frontend/src/features/reels/ReelCard.jsx:13-14`

```javascript
const socials = useSocials();
const socialMap = new Map(socials.map((s) => [s.id, s]));
```

Luego (línea 38-39):
```javascript
{reel.networks.map((id) => (
  <SocialDot key={id} net={socialMap.get(id)} size={24} />
))}
```

**Flujo**:
1. `socials` contiene array con `{ id: 'linkedin', ... }`
2. `socialMap` mapea `'linkedin'` → `{ id: 'linkedin', name: 'LinkedIn', ... }`
3. Si `reel.networks` contiene `'linkedin'`, `socialMap.get('linkedin')` devuelve el objeto
4. Si NO contiene, devuelve `undefined` → se pasa `undefined` a `SocialDot`

---

### 4. Qué pasa si `net` es `undefined` en SocialDot.jsx

**Location**: `/opt/projects/4Reels-Frontend/src/shared/SocialDot.jsx:8-19`

```javascript
export function SocialDot({ net, size = 18 }) {
  if (!net) return null;  // ← DEVUELVE NULL SI net ES UNDEFINED
  return (
    <span className="social-dot" title={net.name} style={{ ... }}>
      <Icon name={net.icon} size={size * 0.6} />
    </span>
  );
}
```

**Conclusión**: SocialDot retorna `null` silenciosamente. No hay placeholder. Simplemente no se renderiza nada.

---

### 5. Variantes de LinkedIn (case sensitivity, slugs alternativos)

Buscando en el código para ver si hay renombramiento:

**En TenantProvider.jsx** (líneas 149-152):
```javascript
const matching =
  byPlatform.get(platform) ||
  byPlatform.get(platform === 'gbp' ? 'gmb' : platform) ||
  byPlatform.get(platform === 'pinterest' ? 'pin' : platform) ||
  [];
```

**Solo hay aliases para `gbp` → `gmb` y `pinterest` → `pin`. NO hay para LinkedIn.**

**Búsqueda de variantes en code**:
- `'linkedin'` - usado en TenantProvider (línea 41, 130)
- `'linkedin'` - usado en DefaultDescriptionsPanel (línea 18)
- `'linkedin'` - usado en AgencyConfigDrawer (línea 2)
- `linkedin: 3000` - usado en editor/defaults.js

**Conclusión**: LinkedIn se referencia como `'linkedin'` (lowercase) en todos lados. No hay variantes como `'linked-in'`, `'linkedIn'`, `'li'`, etc.

---

## DIAGNÓSTICO DEL BUG: POR QUÉ LINKEDIN NO APARECE

### Root Cause (Causa Raíz)

**File: `/opt/projects/4Reels-Frontend/src/features/reels/hooks.js:114-117`**

```javascript
function parseNetworksFromPipeline(workflowState, publishStatus) {
  if (publishStatus === 'published') return ['instagram', 'tiktok', 'facebook'];
  return [];
}
```

**El problema**: 
- Esta función hardcodea que solo `['instagram', 'tiktok', 'facebook']` se publican
- **LinkedIn está ausente de esta lista**
- Aunque el backend envíe información de que LinkedIn fue publicado, el frontend **descarta esa información**
- El mapeo de IDs es correcto (`'linkedin'` en minúsculas), pero **nunca llega un elemento con id `'linkedin'` a `reel.networks`**

### Chain of Failures (Cadena de fallos)

1. Backend publica a LinkedIn
2. Frontend llama `parseNetworksFromPipeline()` 
3. Esta función devuelve hardcoded `['instagram', 'tiktok', 'facebook']`
4. LinkedIn está implícitamente filtrado/ignorado
5. `reel.networks` nunca contiene `'linkedin'`
6. En ReelCard.jsx, el loop `reel.networks.map()` nunca itera sobre LinkedIn
7. LinkedIn no se renderiza (aunque exista en `socialMap`)

### Por qué no es un problema de case sensitivity

- El mapeo es correcto: `useSocials()` devuelve `id: 'linkedin'`
- No hay renombramiento: LinkedIn siempre es `'linkedin'`
- `SocialDot` está correctamente escrito para manejar `undefined`
- **El verdadero culpable es `parseNetworksFromPipeline()`**

### Impacto

- LinkedIn NUNCA aparecerá en cards/tables, incluso si está conectado y el reel se publicó ahí
- La UI debería mostrar: "Live on 3 networks" (si fue a IG/TikTok/FB) 
- Pero podría haber sido "Live on 4 networks" (IG/TikTok/FB/LinkedIn)
- Tracker stats también pueden estar incompletos si LinkedIn tiene engagement

---

## RECOMENDACIONES PARA EL FIX

### Fix Mínimo
Cambiar `parseNetworksFromPipeline()` en `hooks.js:114-117` para incluir `'linkedin'`:

```javascript
function parseNetworksFromPipeline(workflowState, publishStatus) {
  if (publishStatus === 'published') return ['instagram', 'tiktok', 'facebook', 'linkedin'];
  return [];
}
```

### Fix Robusto
Si el backend debería enviar la lista de networks publicados:
- Cambiar el endpoint de GET reel para que devuelva `published_to: ['instagram', 'tiktok', ...]`
- Usar eso en vez de hardcodear
- Esto permitirá que el backend controle qué networks se muestran

### Para el Precio
- Si necesitas formatear precios dinámicamente, reutiliza lógica de `formatPriceSample()`
- Obtén `currency`, `currencyPosition`, `thousandsSep` de defaults (via `useTenantContext()` o hook)
- Aplica el mismo algoritmo a `reel.price`

