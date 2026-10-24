import { informedBot } from './bot-difficulty.mjs';
import { recordReplayStep, transferReplayUndo } from './replay.mjs';
import { command } from './match.mjs';
import { cachedViewFor as viewFor } from './cached-view.mjs';
import { hardBotView, hardBotCommands, hardLibraryWeights } from './hard-bot-policy.mjs';
import { installHardLibraryScorer } from './hard-bot-library.mjs';
import { botCommands } from './bot-policy.mjs';
import { uuid } from './random.mjs';
import { RuleError } from './core.mjs';
installHardLibraryScorer((s, context) => hardLibraryWeights(s, context, viewFor));
const decisionView = s => informedBot(s) ? hardBotView(s, viewFor) : viewFor(s, s.bot.seat, 0, 'BOT');
const decisions = s => { const v = decisionView(s); return informedBot(s) ? hardBotCommands(s, v) : botCommands(v); };
export function runBot(s, { maxActions = 6, maxAttempts = 24 } = {}) {
    if (!s.bot)
        return { actions: 0, pending: false };
    // Undo must remain visible rather than immediately replaying the same move.
    // A paused BOT may still consent to another undo or decline a manual request.
    if (s.bot.undoPaused && !s.manualRequest) {
        s.bot.pending = false;
        return { actions: 0, pending: false };
    }
    let actions = 0, attempts = 0;
    for (; actions < maxActions && attempts < maxAttempts;) {
        const candidates = decisions(s);
        if (!candidates.length)
            break;
        let done = false;
        for (const c of candidates) {
            if (attempts++ >= maxAttempts)
                break;
            const next = structuredClone(s);
            try {
                command(next, s.bot.seat, { ...c, id: uuid() });
            }
            catch (e) {
                if (e instanceof RuleError)
                    continue;
                throw e;
            }
            if (c.botActionKey) {
                next.bot.actionKeys = [...(next.bot.actionKeys ?? []), c.botActionKey].slice(-48);
            }
            for (const key of Object.keys(s))
                delete s[key];
            Object.assign(s, next);
            transferReplayUndo(next, s);
            recordReplayStep(s, s.bot.seat, c);
            actions++;
            done = true;
            break;
        }
        if (!done) {
            if (attempts < maxAttempts)
                s.bot.blocked = '当前结算选择暂不能自动处理';
            break;
        }
        delete s.bot.blocked;
        if (s.bot.undoPaused && !s.manualRequest)
            break;
    }
    const pending = (!s.bot.undoPaused || !!s.manualRequest) && !!decisions(s).length;
    s.bot.pending = pending && !s.bot.blocked;
    return { actions, pending: s.bot.pending, blocked: s.bot.blocked ?? null };
}
