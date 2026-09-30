# Requisitos de Normativa: web y piloto En criollo

## Sistema existente
La rama www contiene la web Astro; lee data e historial publicados en api. main conserva los scrapers. Build pnpm y GitHub Pages; el Worker del dominio enruta. El texto legal y sus fuentes oficiales se mantienen intactos. Búsqueda, fichas, citas y navegación existentes se preservan.

## Piloto aprobado
- 30 explicaciones verificadas y contrastadas sobre Constitución (derechos/deberes), educación y niñez.
- Explicaciones separadas de IMPO, con lenguaje claro y voseo natural.
- No publicar borradores ni inventar revisión jurídica. Responsable y fecha de revisión reales para cada aprobación.
- Panel verde/tinta, sin callout amarillo. Dos columnas desktop y explicación bajo el legal en mobile.
- Costo adicional de lectura cero: HTML estático, sin IA en vivo ni storage nuevo.
- Hash de texto/notas/estado y dependencias invalida explicaciones antiguas. Revisión periódica del contexto sigue siendo necesaria.
- Contenido retirado, derogado o sin texto no recibe explicación vigente.
- Preview de borradores exclusivamente local, no en configuración productiva.

## Aceptación
Pruebas del cierre editorial e invalidación aprobadas; 30 registros con fuente y hash; pnpm build normal y preview correctos; solo registros aprobados en HTML productivo; visual y navegación a 390 y 1280 px sin desbordes. Publicación autorizada para el piloto verificado; no equivale a revisión jurídica profesional.

## Política de contenido
Toda explicación futura requiere verificación normativa vigente y contraste con un libro u obra jurídica antes de publicar. Registrar obra, enlace, pasaje, fecha, método y nivel de respaldo; no confundir anexo normativo con doctrina. Señalar cobertura limitada o edición antigua. El piloto registra contraste documental asistido, no revisión de Lucas ni certificación jurídica. El cambio de texto, notas, estado o dependencia suspende la explicación hasta verificarla otra vez.

### Tanda 2: 50 derechos y principios
25 de Constitución, 11 de Educación y 14 de Niñez. Comparación por artículo registrada en `revision`, con obra, pasaje, nivel de respaldo y criterio. Se agregan Piñeyro (UNICEF, 2017), Galusso/Saravia (UNICEF/MIDES, 2023) y el Manual para la defensa jurídica de los derechos humanos de la infancia (2012).

El respaldo varía: hay comentario directo, mención breve y marco general. No se atribuye comentario exhaustivo a una fuente que no lo contiene. Las ediciones antiguas no prueban la vigencia; Educación 11, 14 y 72 se cotejan con la redacción reformada en IMPO. Constitución 32 incorpora la excepción de los artículos 231-232; 22 distingue pesquisa secreta de reserva legal de investigación; 37 evita convertir lenguaje antiguo en regla de discriminación. Hay dependencias con hash para estas remisiones y para CNA 21 y Educación 73.

El estado interno `aprobado` significa habilitado para el build después de contraste documental asistido, no aprobación humana ni revisión jurídica profesional. La tanda se prepara en #34, sin merge ni despliegue; Lucas decide el merge.
