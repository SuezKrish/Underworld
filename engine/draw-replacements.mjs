import { drawReplacementDecision } from './death-costs.mjs';
import { printedRulesCard } from './printed-rules.mjs';
import { abilitiesSuppressed } from './field-rules.mjs';
import { sealedOn } from './sealing.mjs';
import { skipMemoryDraw } from './veiled-status-rules.mjs';
// Recompute applicable replacements after each choice. Optional labs can
// replace a draw before the mandatory memory effect, leaving it unused when
// no player is drawing anymore. Different owners follow action priority.
export function applyDrawReplacements(s, counts, key, { drawStep, move, log }) {
    const first = s.flow.stepOwner ?? s.turn?.firstPlayer ?? 0, declined = new Set();
    let step = 0;
    while (Object.values(counts).some(n => n > 0)) {
        const memory = !drawStep && s.turn?.step !== 'draw' ? (s.effects ?? []).filter(e => e.kind === 'memory-skip-draw' && e.round === s.round) : [];
        const labs = [first, 1 - first].filter(p => counts[p] > 0 && !declined.has(p)).flatMap(p => s.players[p].play.filter(id => s.locations[id]?.zone === 'play' && !s.locations[id].faceDown && !abilitiesSuppressed(s, id) && printedRulesCard(s, id).automation?.static === 'lab-draw-replacement').map(id => ({ id, controller: p, cardIds: sealedOn(s, id) })));
        if (!memory.length && !labs.length)
            return;
        const memoryOwner = [first, 1 - first].find(p => memory.some(e => (e.controller ?? first) === p));
        const owner = [first, 1 - first].find(p => p === memoryOwner || labs.some(l => l.controller === p));
        if (memory.length && !labs.length) {
            skipMemoryDraw(s, counts, { drawStep });
            log(s, '桑狄亚姆吞忆怪：略过本次全部抓牌，消耗所有生效的吞忆怪略过效果。');
            return;
        }
        const memoryId = 'memory-skip:' + s.round, sources = labs.filter(l => l.controller === owner);
        if (memoryOwner === owner)
            sources.push({ id: memoryId, controller: owner, cardIds: [], name: '桑狄亚姆吞忆怪 · 消耗全部略过效果' });
        const answer = drawReplacementDecision(s, `${key}:replacement:${step++}`, { controller: owner, count: counts[owner] ?? Math.max(...Object.values(counts)), sources, memoryPending: !!memory.length });
        if (answer?.sourceId === memoryId || !answer && memoryOwner === owner) {
            skipMemoryDraw(s, counts, { drawStep });
            log(s, '桑狄亚姆吞忆怪：略过本次全部抓牌，消耗所有生效的吞忆怪略过效果。');
            return;
        }
        declined.add(owner);
        if (answer) {
            counts[owner] = 0;
            if (answer.cardId !== null)
                move(s, answer.cardId, 'hand');
            log(s, '心脑系统重塑实验室：略过整次抓牌' + (answer.cardId === null ? '。' : '，将封印牌置于手中。'));
        }
    }
}
