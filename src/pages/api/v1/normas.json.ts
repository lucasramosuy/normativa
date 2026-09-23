import { API_VERSION, NORMAS, abs, json, normaSummary } from '../../../lib/api';

/** GET /api/v1/normas.json: every norma with counts and links. */
export function GET() {
  return json({
    version: API_VERSION,
    documentacion: abs('api/'),
    fuente_oficial: 'IMPO, Centro de Información Oficial (https://www.impo.com.uy)',
    generado: new Date().toISOString(),
    normas: NORMAS.map(normaSummary),
  });
}
