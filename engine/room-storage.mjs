import { packUndoFrames, unpackUndoFrames } from './undo-history-codec.mjs';
import { upgradeVictoryReductions } from './scoring.mjs';
import { compactTemplateFields, restoreTemplateFields, undoStateFields } from './manual.mjs';
// Versioned bit positions preserve the distinction between absent fields and
// fields explicitly set to a common default. Never reorder this table.
const templateDefaults = [['unique', false], ['token', false], ['cannotMove', false], ['noEquipment', false], ['noAttachments', false], ['conditionalKeywords', {}], ['flavorText', ''], ['keywords', []], ['hiddenAbilities', []], ['magicDomains', []], ['subtitle', ''], ['loyalty', {}]];
function printedTemplates(s) { return [...(s.automationCards ?? []), ...(s.reserveTemplates ?? []), ...(s.environmentCatalog ?? [])]; }
// Store printed templates once per room. Keep instance overrides, object state,
// and explicit deletions, including the checkpoints used by cost choices/undo.
export function serializeRoomState(state) {
    const s = structuredClone(state), templates = new Map([...(s.automationCards ?? []), ...(s.reserveTemplates ?? [])].map(c => [c.catalogId, c]));
    function compact(snapshot) {
        if (snapshot !== s)
            for (const key of ['automationCards', 'reserveTemplates', 'environmentCatalog'])
                if (Object.hasOwn(snapshot, key) && JSON.stringify(snapshot[key]) === JSON.stringify(s[key]))
                    delete snapshot[key];
        compactTemplateFields(snapshot, templates);
        // Map keys already identify instances. Store only exceptional absent or different IDs.
        if (!Object.hasOwn(snapshot, '__undoIdKeysV1')) {
            const exceptions = [];
            for (const [id, c] of Object.entries(snapshot.cards ?? {})) {
                if (c.id === id)
                    delete c.id;
                else
                    exceptions.push(id);
            }
            snapshot.__roomIdKeysV1 = exceptions;
        }
        if (snapshot.deathContinuation?.before)
            compact(snapshot.deathContinuation.before);
        for (const frame of snapshot.undoFrames ?? [])
            compact(frame.state);
    }
    compact(s);
    for (const c of printedTemplates(s)) {
        if (c.attachment && c.automation && JSON.stringify(c.attachment) === JSON.stringify(c.automation)) {
            delete c.attachment;
            c.__roomAttachmentAlias = true;
        }
        if (c.spell && c.automation && JSON.stringify(c.spell) === JSON.stringify(c.automation)) {
            delete c.spell;
            c.__roomSpellAlias = true;
        }
        let defaults = 0;
        templateDefaults.forEach(([key, value], i) => {
            if (Object.hasOwn(c, key) && JSON.stringify(c[key]) === JSON.stringify(value)) {
                delete c[key];
                defaults |= 1 << i;
            }
        });
        if (defaults)
            c.__roomDefaultsV1 = defaults;
    }
    if (s.undoFrames?.length)
        s.undoFrames = packUndoFrames(s.undoFrames, undoStateFields(s));
    let result = JSON.stringify(s);
    // Prefer the most recent undo checkpoints when a large frozen card pool and
    // an interrupted cost choice approach the database's record-size budget.
    while (new TextEncoder().encode(result).byteLength > 1900000 && s.undoFrames?.length) {
        s.undoFrames.shift();
        result = JSON.stringify(s);
    }
    return result;
}
export function deserializeRoomState(serialized) {
    const s = JSON.parse(serialized);
    if (s.undoFrames?.length)
        s.undoFrames = unpackUndoFrames(s.undoFrames, undoStateFields(s));
    function ids(snapshot) {
        if (Object.hasOwn(snapshot, '__roomIdKeysV1')) {
            const exceptions = new Set(snapshot.__roomIdKeysV1);
            for (const [id, c] of Object.entries(snapshot.cards ?? {}))
                if (!exceptions.has(id) && !Object.hasOwn(c, 'id'))
                    c.id = id;
            for (const [p, c] of (snapshot.societies ?? []).entries()) {
                const id = `society:${p}`;
                if (c && snapshot.cards?.[id] && !exceptions.has(id) && !Object.hasOwn(c, 'id'))
                    c.id = id;
            }
            delete snapshot.__roomIdKeysV1;
        }
        if (snapshot.deathContinuation?.before)
            ids(snapshot.deathContinuation.before);
        for (const f of snapshot.undoFrames ?? [])
            ids(f.state);
    }
    ids(s);
    for (const c of printedTemplates(s)) {
        if (c.__roomAttachmentAlias) {
            c.attachment = structuredClone(c.automation);
            delete c.__roomAttachmentAlias;
        }
        if (c.__roomSpellAlias) {
            c.spell = structuredClone(c.automation);
            delete c.__roomSpellAlias;
        }
        if (c.__roomDefaultsV1) {
            templateDefaults.forEach(([key, value], i) => {
                if (c.__roomDefaultsV1 & (1 << i))
                    c[key] = structuredClone(value);
            });
            delete c.__roomDefaultsV1;
        }
    }
    restoreTemplateFields(s);
    const upgrade = snapshot => {
        upgradeVictoryReductions(snapshot);
        if (snapshot.deathContinuation?.before)
            upgrade(snapshot.deathContinuation.before);
        for (const f of snapshot.undoFrames ?? [])
            upgrade(f.state);
    };
    upgrade(s);
    return s;
}
