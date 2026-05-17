# Diagnóstico backend: ¿qué hace `/approve`?

**Fecha:** 2026-05-13
**Pregunta:** Cuando el frontend POST a `/v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/approve`,
¿el backend publica en redes o solo marca approved?

## Veredicto

**(A) Auto-publish ESTÁ implementado y funcionando.**

`/approve` no es un endpoint dummy: encola un job que dispara el pipeline
completo y publica a las redes conectadas vía GoHighLevel.

## Flujo confirmado

1. **Handler:** `modules/reels/api/admin_reels_router.py:163-229` recibe el POST.
2. **Use case:** `modules/reels/application/use_cases/regenerate_reel.py:99-320`
   - UPDATE `workflow_state='approved'`, `publish_status='pending_publish'`.
   - Encola job `reel_publish` con `approval_required=False` **forzado** en
     línea 255 (precisamente para que el siguiente paso publique sin volver
     a parar).
3. **Worker:** ejecuta pipeline 4 etapas vía `modules/reels/application/orchestrator.py:69-221`:
   PROPERTY INGESTION → MEDIA PREPARE → MEDIA RENDER → **MEDIA PUBLISH**.
4. **Publish:** `PublishReelUseCase._publish_externally`
   (`modules/reels/application/use_cases/publish_reel.py:171-369`) llama a
   `self.social_publisher.publish_property_media()` →
   `GoHighLevelPropertyPublisher` hace batch multi-plataforma.

## Evidencia en logs (worker)

Las líneas que aparecen en un approve exitoso:
```
PUBLISH GATING DECISION → will publish (approval_required=False)
SOCIAL MEDIA PUBLISH STARTED
GOHIGHLEVEL MULTI-PLATFORM PUBLISH STARTED
GOHIGHLEVEL PLATFORM PUBLISH COMPLETED (TikTok, Instagram, ...)
SOCIAL MEDIA PUBLISH COMPLETED → AGGREGATE STATUS: published
```

Si **no** ves estas líneas en `logs/test-worker.log` cuando aprueba el
usuario, el problema está en uno de:

1. **Worker no corriendo** — `ps aux | grep worker` debe mostrar proceso vivo.
2. **GHL token expirado o agency sin GHL conectado** —
   `regenerate_reel.execute()` valida prerequisites antes de encolar.
3. **No hay social_accounts conectadas** para esa agencia, así que el
   publisher no tiene a quién publicar.
4. **Falla silenciosa en `_publish_externally`** — buscar
   `Social Media Publish Failed` en logs del worker.

## Implicación para la feature solicitada

Lo que el usuario describió ("Approve debe publicar también") **ya es el
comportamiento implementado**. No hace falta endpoint nuevo ni cambios en
frontend. El bug es operacional: por algún motivo el publish del approve
de ese reel no llega a las redes.

**Próximo paso:** diagnosticar el approve concreto del usuario en los logs,
no escribir código nuevo.

## Referencias

| Componente | Archivo | Líneas |
|------------|---------|--------|
| Handler approve | `modules/reels/api/admin_reels_router.py` | 163-229 |
| Use case (encolar publish) | `modules/reels/application/use_cases/regenerate_reel.py` | 99-320, esp. 255 |
| Orchestrator pipeline | `modules/reels/application/orchestrator.py` | 69-221 |
| Publish use case | `modules/reels/application/use_cases/publish_reel.py` | 171-369 |
| Test que confirma approval_required=False | `tests/unit/reels/test_regenerate_reel.py` | 92 |
