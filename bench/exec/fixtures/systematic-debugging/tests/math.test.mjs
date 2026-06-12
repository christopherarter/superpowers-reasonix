import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median } from '../src/math.mjs';

test('median of odd-length', () => { assert.equal(median([3, 1, 2]), 2); });
test('median of even-length averages the middle two', () => { assert.equal(median([1, 2, 3, 4]), 2.5); });
