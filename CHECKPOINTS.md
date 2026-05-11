# CHECKPOINTS — Evaluación del estado final (`4reels front/`)

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede
> usar para decidir si el frontend está sano tras una sesión.

## C1 — El arnés está completo

- [ ] Existen los archivos base: `AGENTS.md`, `CLAUDE.md`, `init.sh`,
      `feature_list.json`, `progress/current.md`.
- [ ] Existen los 3 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`.
- [ ] `./init.sh` termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests E2E o de smoke asociados que
      pasan.
- [ ] `progress/current.md` está vacío o describe la sesión activa.
- [ ] `progress/history.md` tiene una entrada por la última sesión
      cerrada.

## C3 — El código respeta la arquitectura

- [ ] **Sin TypeScript** (`*.ts`, `*.tsx`) en `src/`.
- [ ] **Sin React Query, sin MSW**, sin nuevas libs de state.
- [ ] **Vanilla CSS** — sin styled-components ni Tailwind ni CSS-in-JS.
- [ ] Ningún componente bajo `src/features/` o `src/shared/` llama
      `fetch(...)` directamente. Todo pasa por
      `lib/api/client.js` vía un hook de feature.
- [ ] `src/shared/` no importa de `src/features/` ni de `src/lib/api/`.
- [ ] `src/lib/` no importa de `src/features/`, `src/app/`, `src/shared/`.
- [ ] `src/app/` no contiene lógica de dominio (solo providers + shell).

## C4 — La verificación es real

- [ ] `npm run lint` termina verde.
- [ ] `npm run build` termina verde.
- [ ] Si la feature toca UI: hay test Playwright (smoke o e2e) que
      cubre el flujo principal.
- [ ] `npm run test:smoke` termina verde sobre los flujos tocados.
- [ ] Si la feature toca el "look": hay snapshot visual (`test:visual`)
      actualizado y aceptado.

## C5 — El contrato mock-backend está vivo

- [ ] Si la feature añade un endpoint nuevo: existe su handler en
      `src/lib/api/mock/handlers/<feature>.js` y está registrado.
- [ ] El shape del mock matchea el shape esperado del backend real
      (ver `DOCS.md` § "Backend contract"); cualquier diferencia se
      documenta como TODO en el handler.
- [ ] `tests/support/mock-backend.js` cubre los nuevos endpoints
      cuando los tests E2E los necesitan.

## C6 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`.tmp_vite_*.log`,
      `dist/` modificado a mano, `node_modules/` parcheado).
- [ ] No hay `console.log` ni `debugger` en el código de
      `src/`.
- [ ] La última feature trabajada está reflejada en su estado correcto
      en `feature_list.json`.
- [ ] No se han añadido dependencias en `package.json` sin justificación
      en el informe del implementer.

---

**Cómo usar este archivo:** un agente revisor (`.claude/agents/reviewer.md`)
recorre cada checkbox, marca `[x]` o `[ ]`, y rechaza el cierre de
sesión si quedan boxes vacíos en C1-C6.
