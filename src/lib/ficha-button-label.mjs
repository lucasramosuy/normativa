/** Give each saved-material control a distinct, state-aware accessible name. */
export function fichaButtonAriaLabel(itemLabel, inFicha) {
  const item = String(itemLabel ?? '').trim() || 'este artículo';
  return inFicha ? `Quitar ${item} de la ficha` : `Agregar ${item} a la ficha`;
}
