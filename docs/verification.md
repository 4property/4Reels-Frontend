# Verificación — Cómo demostrar que el trabajo funciona (`4reels front/`)

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.

## Niveles de verificación

### Nivel 1 — Lint + build (obligatorio, siempre)

```bash
npm run lint
npm run build
```

Ambos exit code 0. `init.sh` ya los ejecuta. Si rompen, **para**.

### Nivel 2 — Smoke E2E (obligatorio si la feature toca UI)

```bash
npm run test:smoke
```

Cubre los flujos críticos. Si añadiste una pestaña o un editor nuevo,
añade un smoke test que:

1. Navega a la nueva ruta.
2. Realiza la acción principal (crear, editar, publicar, …).
3. Verifica el resultado en pantalla y en el mock store.

### Nivel 3 — E2E completo (obligatorio antes de cerrar features grandes)

```bash
npm run test:e2e
```

Permutaciones, edge cases, validaciones de formularios, errores de red
simulados.

### Nivel 4 — Visual (obligatorio si la feature toca el "look")

```bash
npm run test:visual            # corre y compara contra snapshots
npm run test:visual:update     # acepta las nuevas baselines
```

Cuando aceptes una nueva baseline, lo documentas en
`progress/current.md` con un bullet por captura.

### Nivel 5 — Smoke manual con dev server (recomendado)

```bash
npm run dev
# abre http://localhost:5173 (o el puerto que use Vite)
# prueba la feature en un browser real
```

Especialmente útil cuando la feature involucra:

- Drag & drop, resizable panels, virtualización.
- Animaciones, transiciones, scroll behavior.
- Integración con `localStorage` o `sessionStorage`.
- Atajos de teclado.

Si solo ves `npm run test:smoke` verde pero no has tocado el browser,
**dilo en el informe** ("no manual smoke") — no afirmes "funciona en
el browser" sin haberlo abierto.

## Anti-patrones (no hacer)

- ❌ "He añadido el componente, debería funcionar." → falta test
  ejecutable.
- ❌ Test que solo monta el componente y comprueba que no lanza. →
  tiene que comprobar el resultado (texto en pantalla, llamada al mock
  store, evento disparado).
- ❌ Skipear test E2E porque "el componente es trivial". Si está en
  pantalla, hay un flujo que verificar.
- ❌ Dejar `test.only(...)` o `test.skip(...)` en el código.
- ❌ Modificar snapshots visuales sin abrir el browser y confirmar
  visualmente.
- ❌ Marcar la feature como `done` sin pasar `./init.sh`.
- ❌ Cubrir la feature con un mock que devuelve algo que el backend
  real no podrá devolver. El mock = spec.

## Verificación final antes de cerrar

```bash
./init.sh                     # lint + build verdes
npm run test:smoke            # smoke verde
# si tocó UI nueva con permutaciones:
npm run test:e2e
# si tocó visuales:
npm run test:visual
```

Si algo está rojo, **no** marques nada como `done`. Anota el bloqueo
en `progress/current.md` con estado `blocked` en `feature_list.json`.
