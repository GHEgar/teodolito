import { describe, expect, it } from 'vitest';
import type { Arbiter } from '../../../urdimbre/src/arbiter/index.js';
import type { ToolArbiter } from '../../src/core/index.js';

const arbiterFits = (arbiter: Arbiter): ToolArbiter => arbiter;

describe('encaje con urdimbre', () => {
    it('acepta el árbitro de urdimbre donde teodolito pide uno estructural', () => {
        expect(arbiterFits).toBeTypeOf('function');
    });
});
