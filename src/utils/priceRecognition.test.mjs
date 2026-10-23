import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseRecognizedPrice } from './priceRecognition.mjs';

describe('parseRecognizedPrice', () => {
  it('accepts readable prices that end in 0 or 5', () => {
    const examples = [
      ['120', '120'],
      ['R$ 45', '45'],
      ['50,00', '50'],
      ['1.200', '1200'],
      ['1.200,00', '1200'],
    ];

    for (const [input, expected] of examples) {
      assert.equal(parseRecognizedPrice(input), expected, `input: ${input}`);
    }
  });

  it('rejects prices with uncertain cents instead of rounding them', () => {
    assert.equal(parseRecognizedPrice('42,90'), '');
    assert.equal(parseRecognizedPrice('42.99'), '');
  });

  it('rejects values that do not end in 0 or 5, invalid formats, and out-of-range values', () => {
    for (const input of ['43', '0', '-5', '100000', '12abc', '', null]) {
      assert.equal(parseRecognizedPrice(input), '', `input: ${input}`);
    }
  });
});
