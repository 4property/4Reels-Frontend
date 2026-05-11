# Arquitectura — Qué significa "hacer un buen trabajo" (`4reels front/`)

> Este documento es un **resumen operativo** para el agente. La fuente
> de verdad son [`ARCHITECTURE.md`](../ARCHITECTURE.md) y
> [`DOCS.md`](../DOCS.md) en la raíz del proyecto. Si hay conflicto,
> ganan ellos.

## Stack

- **React 18 + Vite.**
- **JS/JSX vanilla** — sin TypeScript.
- **Vanilla CSS** — sin styled-components, sin Tailwind, sin CSS-in-JS.
- **Sin React Query.** Server state vía `useApi` / `useMutation` de
  `lib/hooks/`.
- **Sin MSW.** Mock implementado a mano en `src/lib/api/mock/`. Para
  tests E2E, mock vía `tests/support/mock-backend.js`.
- **Routing**: `react-router-dom` v6 (sí permitido).
- **Tests**: Playwright (smoke / e2e / visual).
- **Lint**: ESLint flat config (`eslint.config.js`).

## Layout

```
src/
├── main.jsx, App.jsx        Entry + providers
├── app/                     Shell, topbar, tab router, providers
│   ├── Shell.jsx
│   ├── pages.js
│   └── providers/           ThemeProvider, TenantProvider
├── lib/                     Capa base
│   ├── api/
│   │   ├── client.js        Único punto que hace fetch real o llama al mock
│   │   └── mock/            Mock backend (handlers + store)
│   │       ├── store.js     Datos en memoria
│   │       └── handlers/    Un archivo por dominio
│   └── hooks/               useApi, useMutation, useLocalStorage
├── shared/                  UI primitives (Icon, Cover, Toggle, …)
├── features/                Una carpeta por dominio
│   ├── reels/               api.js, hooks.js, componentes, index.js
│   ├── music/
│   ├── social/
│   ├── brand/
│   ├── defaults/
│   ├── automation/
│   ├── admin/
│   └── notifications/
└── styles/                  Vanilla CSS, un archivo por responsabilidad
```

## Data flow

```
Component → feature hook → feature api → lib/api/client.js
                                              │
                                  VITE_USE_MOCK=true  → in-memory mock
                                  VITE_USE_MOCK=false → fetch(VITE_API_URL)
```

**Componentes nunca llaman `fetch` directamente.** Siempre vía hook de
feature.

## Layer rules

- `shared/` — pura presentación, sin deps de datos. No importa de
  `features/`, `lib/api/` ni `app/providers/`.
- `features/<x>/` — puede importar de `shared/`, `lib/`,
  `app/providers/`.
- `app/` — providers + shell. No contiene lógica de dominio.
- `lib/` — base. No importa nada de arriba (`features/`, `app/`,
  `shared/`).

## State

- **Server state**: `useApi` (lectura) / `useMutation` (escritura) de
  `lib/hooks/`.
- **Global UI**: `ThemeProvider`, `TenantProvider` en `app/providers/`.
  Solo concerns transversales reales — no metas state de feature aquí.
- **Local UI**: `useState`. Por defecto.
- **Persistencia**: `useLocalStorage` (theme, current tab).

## Mock = Spec

`src/lib/api/mock/` es la **especificación** del backend real. Cuando
añadas un endpoint:

1. Define el shape exacto en el handler del mock.
2. Documenta el contrato en `DOCS.md` § "Backend contract" si es nuevo.
3. El backend (4reels back) lo implementa con el mismo path y el mismo
   shape. Si descubres un mismatch, **cambia el mock** y avisa al
   leader; no hagas que el frontend "se adapte" al backend.

## Cómo añadir una feature

(Eco de `ARCHITECTURE.md` § "Adding a feature".)

1. Crea `src/features/<name>/` con `api.js`, `hooks.js`, componentes,
   `index.js`.
2. Añade un handler en `src/lib/api/mock/handlers/<name>.js` y
   regístralo en el index del mock.
3. Si la feature es navegable: añade la pestaña en `src/app/pages.js`
   y engánchala en `src/app/Shell.jsx`.
4. Crea `src/styles/<name>.css` y vincúlalo desde el componente raíz
   de la feature.
5. Añade test smoke en `tests/` cubriendo el flujo principal.

## Qué NO hacer

- ❌ Importar `fetch` o `XMLHttpRequest` desde un componente.
- ❌ Añadir TypeScript, React Query, MSW, styled-components, Tailwind,
  Redux, Zustand, Recoil, Jotai, … sin pasar por el leader.
- ❌ Que `shared/` importe de `features/` o `lib/api/`.
- ❌ Que `lib/` importe de `features/`, `app/` o `shared/`.
- ❌ CSS inline o `<style>` tags inline (excepto demos triviales en
  Storybook si llegara). Vanilla CSS por archivo, importado por la
  feature.
- ❌ Mover lógica de feature a `app/` "para tenerla global".
- ❌ Crear hooks genéricos que vivan dentro de una feature; los
  genéricos viven en `lib/hooks/`.
