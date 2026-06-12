import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.mjs';
test('parses key=value', () => { assert.deepEqual(parseConfig('a = 1\nb = two'), { a: '1', b: 'two' }); });
