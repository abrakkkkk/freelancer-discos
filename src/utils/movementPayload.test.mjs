import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMovementPayload } from './movementPayload.mjs';

describe('createMovementPayload', () => {
  const foreignKeyByCategory = {
    discos: 'disco_id',
    dvds: 'dvd_id',
    cds: 'cd_id',
    vhs: 'vhs_id',
  };

  for (const [category, foreignKey] of Object.entries(foreignKeyByCategory)) {
    it(`links ${category} movements to the correct item`, () => {
      assert.deepEqual(
        createMovementPayload(category, 'item-123', 'entrada', 2, 'Cadastro'),
        {
          tipo: 'entrada',
          quantidade: 2,
          observacao: 'Cadastro',
          [foreignKey]: 'item-123',
        }
      );
    });
  }

  it('defaults missing quantity and observation consistently', () => {
    assert.deepEqual(createMovementPayload('discos', 'item-123', 'saida'), {
      tipo: 'saida',
      quantidade: 1,
      observacao: null,
      disco_id: 'item-123',
    });
  });

  it('rejects unknown stock categories rather than creating an unlinked movement', () => {
    assert.throws(
      () => createMovementPayload('livros', 'item-123', 'entrada'),
      /Categoria de estoque inválida/
    );
  });
});
