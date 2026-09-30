/** Small same-origin explorer. OpenAPI is its single source for paths and schemas. */
export async function setupApiLab() {
  const root = document.querySelector('[data-api-lab]');
  if (!root) return;
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const endpoint = el<HTMLSelectElement>('endpoint');
  const norma = el<HTMLSelectElement>('norma');
  const article = el<HTMLInputElement>('articulo');
  const run = el<HTMLButtonElement>('run');
  const copyJson = el<HTMLButtonElement>('copy-json');
  const status = el('status');
  const response = el('response');
  const curl = el('curl');
  const server = new URL(`${import.meta.env.BASE_URL}api/v1/`, location.origin);
  let spec: any;
  let path = '';
  let jsonText = '';
  run.disabled = true;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/openapi.json`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error();
    spec = await res.json();
  } catch {
    status.textContent = 'No se pudo cargar OpenAPI. Recargá para volver a intentar.';
    return;
  }
  function update() {
    const template = endpoint.value;
    const hasNorma = template.includes('{norma}');
    const hasArticle = template.includes('{articulo}');
    el('norma-field').hidden = !hasNorma;
    el('articulo-field').hidden = !hasArticle;
    article.disabled = !hasArticle;
    path = template.replace('{norma}', encodeURIComponent(norma.value)).replace('{articulo}', encodeURIComponent(article.value.trim().toLowerCase()));
    el('request-path').textContent = path.slice(1);
    curl.textContent = `curl '${new URL(path.slice(1), server).href}'`;
    const operation = spec.paths[template].get;
    el('endpoint-description').textContent = operation.description;
    const name = operation.responses['200'].content['application/json'].schema.$ref.split('/').at(-1);
    el('schema').textContent = JSON.stringify({ schema: spec.components.schemas[name], components: spec.components }, null, 2);
  }
  update();
  run.disabled = false;
  endpoint.addEventListener('change', update);
  norma.addEventListener('change', update);
  article.addEventListener('input', update);
  el<HTMLFormElement>('api-form').addEventListener('submit', async event => {
    event.preventDefault();
    update();
    const requestedPath = path;
    run.disabled = true;
    copyJson.disabled = true;
    jsonText = '';
    response.textContent = 'Consultando…';
    status.textContent = `GET ${requestedPath} · Consultando…`;
    const start = performance.now();
    try {
      const res = await fetch(new URL(requestedPath.slice(1), server), { signal: AbortSignal.timeout(15000), credentials: 'omit' });
      const text = await res.text();
      status.textContent = `GET ${requestedPath} · HTTP ${res.status} · ${Math.round(performance.now() - start)} ms`;
      if (!res.ok) {
        response.textContent = res.status === 404 ? 'Este recurso no está publicado. Revisá el slug de la norma y el ID del artículo en su índice.' : 'La consulta falló. Volvé a intentar en unos minutos.';
      } else {
        try { jsonText = JSON.stringify(JSON.parse(text), null, 2); }
        catch { throw new Error('invalid-json'); }
        response.textContent = jsonText;
        copyJson.disabled = false;
      }
    } catch (err) {
      const name = (err as Error).name;
      status.textContent = name === 'TimeoutError' ? 'La consulta tardó más de 15 segundos.' : 'No se pudo leer la respuesta.';
      response.textContent = 'Revisá tu conexión o intentá de nuevo. No se muestran datos anteriores.';
    } finally { run.disabled = false; }
  });
  async function copy(button: HTMLButtonElement, text: string) {
    const label = button.textContent;
    try { await navigator.clipboard.writeText(text); button.textContent = 'Copiado'; }
    catch { status.textContent = 'No se pudo copiar. Seleccioná el texto de la respuesta o el cURL y copialo manualmente.'; }
    setTimeout(() => button.textContent = label, 1800);
  }
  copyJson.addEventListener('click', () => copy(copyJson, jsonText));
  el<HTMLButtonElement>('copy-curl').addEventListener('click', event => copy(event.currentTarget as HTMLButtonElement, curl.textContent || ''));
}
