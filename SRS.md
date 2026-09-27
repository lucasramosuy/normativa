# Especificación de requisitos de software: Normativa Uruguay

**Estado:** revisión de las ramas `main`, `api` y `www` al 27/09/2026. Este archivo se incorpora a `main`, pero describe el producto completo y las fronteras entre ramas. No convierte los pendientes del README en funciones existentes.

## Propósito y usuarios

Normativa Uruguay reúne legislación uruguaya obtenida de IMPO para consultar, buscar, leer y reutilizar artículos, con historial de lo que el proyecto publicó. Lectores, estudiantes y docentes consultan el sitio; consumidores técnicos pueden usar la API estática abierta. El contenido oficial y su vigencia dependen de IMPO: el proyecto debe mostrar la fuente y no presentarse como sustituto de asesoramiento jurídico ni como registro oficial propio.

## Requisitos funcionales

- **RF-01. Ingesta:** obtener Constitución, códigos, leyes y decretos configurados en `scripts/ingest/`, respetando `robots.txt`, identificación del agente y Crawl-Delay de IMPO. Generar un archivo JSONL por norma, una línea por artículo, y reportes de cobertura, validación y errores.
- **RF-02. Validación y continuidad:** contrastar los artículos con el índice oficial; no escribir una norma con faltantes o duplicados no resueltos. Si IMPO falla temporalmente para una norma, conservar su versión anterior y registrar el error para la siguiente revisión. Representar artículos sin texto con su estado/notas, sin inventar contenido.
- **RF-03. Revisión y publicación:** la revisión semanal abre PR a `main` solo cuando hay cambios. La publicación a `api` es manual y separada del merge en `main`; genera historial de cambios por artículo a partir de publicaciones, no de cualquier scraping. La web `www` se construye con datos de `api` y se despliega a GitHub Pages.
- **RF-04. Consulta web:** mostrar listado, exploración, búsqueda estática Pagefind, páginas por norma y artículo, estados de artículos retirados/derogados, referencias y páginas explicativas. Un artículo retirado conserva su URL con aviso. Las funciones existentes incluyen ficha editable local para material de clase, mesa de lectura, referencias APA, mapa de citas, curiosidades y feed de cambios.
- **RF-05. API v1:** publicar recursos JSON estáticos de catálogo, normas, artículos e historial bajo `/normativa/api/v1/`, con documentación; no requerir cuenta ni clave. No confundir la fecha de detección/publicación de un cambio con su fecha de vigencia legal.
- **RF-06. Procedencia:** cada registro debe conservar identificador de artículo, texto, encabezados de norma, notas oficiales, estado, fechas disponibles, URL de IMPO, fecha de extracción y hash de contenido. La interfaz debe permitir llegar a su fuente y señalar fechas desconocidas en vez de fabricarlas.

## Datos y arquitectura

`main`: Python con requests/BeautifulSoup, configuración de normas en `codigos.json` y `leyes.json`, `data/*.jsonl` y `reports/`. `api`: copia publicada de `data/` y `reports/` e `historial/<norma>.json` más índice. `www`: Astro y Tailwind, build estático con pnpm que obtiene `api`, Pagefind y endpoints JSON generados; `worker/proxy.js` versiona el router de Cloudflare que expone `/normativa/*` desde GitHub Pages y maneja los proxies de telemetría. Los cambios al archivo del Worker no se despliegan solos. Los nombres y listados de normas de ingestión y web deben mantenerse alineados.

## Restricciones y calidad

- Priorizar software y hosting gratuitos: GitHub Actions/Pages y Cloudflare Worker; no introducir servicios pagos o dependencias de Google. El frontend usa fuentes Fontsource locales. Sin publicación automática de datos legales: Lucas revisa PR y decide cuándo promover a `api`.
- El sitio puede usar Sentry y PostHog mediante rutas de primera parte; grabaciones de sesión y encuestas están deshabilitadas. No exponer secretos como `SENTRY_AUTH_TOKEN` al cliente. La API es pública y estática, sin autenticación.
- Preservar URLs de artículos y la procedencia de IMPO. Un error de red no debe borrar datos anteriores; los informes deben permitir ver fallas parciales. La revisión semanal tiene límite de ejecución (240 minutos según README) y respeta las pausas del origen.
- Verificar formato y diff de JSONL, integridad del historial y build estático antes de publicar. La rama `www` requiere `pnpm install`, carga de datos de `api` y `pnpm run build`.
