// Curiosidades del corpus: récords que salen de los datos del sitio. Se calcula una vez en el build.
import { NORMAS, getArticles, idOf, labelOf, splitTitle, type Article, type Norma } from '../data/normas';
import { citadoPor } from './citas';

export type Art = { n: Norma; a: Article; id: string; label: string; rubro: string | null; cuerpo: string };

const FORMULA = /^(c[ou]mun[íi]quese|publ[íi]quese|d[ée]se|ins[ée]rtese|arch[íi]vese|regístrese)/i;
const fecha = (s?: string) => { const m = /(\d\d)\/(\d\d)\/(\d{4})/.exec(s || ''); return m ? { t: Date.UTC(+m[3], +m[2] - 1, +m[1]), anio: +m[3], txt: `${+m[1]}/${+m[2]}/${m[3]}` } : null; };

export function curiosidades() {
  const arts: Art[] = [];
  for (const n of NORMAS) for (const a of getArticles(n.slug)) {
    const { rubro, body } = splitTitle(a.texto || '');
    arts.push({ n, a, id: idOf(a), label: labelOf(a), rubro, cuerpo: body.replace(/\(\*\)/g, '').trim() });
  }
  const conTexto = arts.filter(x => x.cuerpo && !/^(derogad|suprimid|sin efecto)/i.test(x.cuerpo) && !/^[.\-\s]+$/.test(x.cuerpo));
  const masCitados = arts.map(x => ({ ...x, citas: citadoPor(x.n.slug, x.id).length })).sort((a, b) => b.citas - a.citas).slice(0, 5);
  const largo = [...conTexto].sort((a, b) => b.cuerpo.length - a.cuerpo.length)[0];
  const cortos = conTexto.filter(x => !FORMULA.test(x.cuerpo)).sort((a, b) => a.cuerpo.length - b.cuerpo.length);
  const formula = conTexto.filter(x => /^comun[íi]quese, etc\.?$/i.test(x.cuerpo));
  const normas = NORMAS.map(n => {
    const as = getArticles(n.slug);
    return { n, arts: as.length, chars: as.reduce((s, a) => s + (a.texto || '').length, 0), f: fecha(as[0]?.fecha_promulgacion) };
  });
  const leyes = normas.filter(x => x.n.tipo === 'Ley' || x.n.tipo === 'Decreto-ley');
  const porFecha = normas.filter(x => x.f).sort((a, b) => a.f!.t - b.f!.t);
  const leyesPorFecha = porFecha.filter(x => x.n.tipo === 'Ley' || x.n.tipo === 'Decreto-ley');
  const palabras = arts.reduce((s, x) => s + (x.a.texto || '').split(/\s+/).filter(Boolean).length, 0);
  const notas = [...arts].sort((a, b) => (b.a.notas_oficiales || '').length - (a.a.notas_oficiales || '').length)[0];
  const sufijos = arts.filter(x => /-(bis|ter|quater|quinquies|sexies)/.test(x.id));
  const nombreLargo = [...sufijos].sort((a, b) => b.id.length - a.id.length)[0];
  return {
    total: { normas: NORMAS.length, articulos: arts.length, palabras, horas: Math.round(palabras / 250 / 60) },
    masCitados,
    normaMasLarga: [...normas].sort((a, b) => b.arts - a.arts)[0],
    leyMasLarga: [...leyes].sort((a, b) => b.arts - a.arts)[0],
    leyMasCorta: [...leyes].filter(x => x.chars > 0).sort((a, b) => a.arts - b.arts || a.chars - b.chars)[0],
    masAntigua: porFecha[0], leyMasAntigua: leyesPorFecha[0], masReciente: porFecha.at(-1)!,
    artMasLargo: largo, artMasCorto: cortos[0], formula,
    masNotas: notas, sufijos: sufijos.length, nombreLargo,
  };
}
