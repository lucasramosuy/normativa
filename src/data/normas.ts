import fs from 'node:fs';
import path from 'node:path';

export type Article = {
  articulo: number; capitulo?: string; documento: string; estado_actual?: string;
  fecha_publicacion?: string; notas_oficiales?: string; seccion?: string;
  texto: string; titulo?: string; url_fuente: string;
};

const dataPath = path.resolve('data/constitucion.jsonl');
export const articles: Article[] = fs.readFileSync(dataPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).sort((a,b)=>a.articulo-b.articulo);
export const sections = [...new Set(articles.map(a => a.seccion).filter(Boolean))] as string[];
export const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
