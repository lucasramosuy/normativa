import { json } from '../../lib/api';
import { openapi } from '../../lib/openapi';
export function GET() { return json(openapi); }
