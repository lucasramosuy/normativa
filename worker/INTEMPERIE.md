# Ruta intemperie

`worker/proxy.js` es el mirror del Worker `proxy` del dominio. Agrega `/intemperie/*` → `https://lucasramosuy.github.io/intemperie/*`, sin cambiar el root ni el fallback de Cloudflare `p-<nombre>`.

- `/intemperie` redirige a `/intemperie/`, conservando query.
- HTML, módulos, CSS y `weather.json` conservan el prefijo; las cookies no viajan a GitHub.
- Snapshot y hora vienen del deploy propio de intemperie, no se añade API ni cron en el router.
- 404 y redirects de upstream mantienen el comportamiento existente.
- Ejecutar `node --test worker/intemperie.test.mjs` desde la raíz.

Esta PR es el cambio versionado. **Mergear este archivo no despliega automáticamente el Worker**: aplicar la misma línea al Worker `proxy` de Cloudflare y verificar `/intemperie/` y `/intemperie/weather.json` en el dominio. No declarar dominio live solo por el merge.
