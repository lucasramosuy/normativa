import assert from 'node:assert/strict';
import test from 'node:test';
import { fichaButtonAriaLabel } from '../src/lib/ficha-button-label.mjs';

test('search result buttons identify the item they add', () => {
  assert.equal(fichaButtonAriaLabel('Reclusión Carcelaria, artículo 54', false), 'Agregar Reclusión Carcelaria, artículo 54 a la ficha');
  assert.equal(fichaButtonAriaLabel('Reclusión Carcelaria, artículo 5', false), 'Agregar Reclusión Carcelaria, artículo 5 a la ficha');
});

test('the accessible action changes when the item is already in the ficha', () => {
  assert.equal(fichaButtonAriaLabel('Reclusión Carcelaria, artículo 54', true), 'Quitar Reclusión Carcelaria, artículo 54 de la ficha');
});
