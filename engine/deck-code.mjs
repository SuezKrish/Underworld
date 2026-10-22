import { normalizeDeck } from './deck-rules.mjs';
export const DECK_CODE_PREFIX = 'HWD1.';
export const MAX_DECK_CODE_LENGTH = 140000;
const MAX_DECK_BYTES = 100000;
function deckDocument(input) {
    if (input?.schemaVersion !== undefined && input.schemaVersion !== 1)
        throw Error('不支持这个版本的卡组代码');
    return normalizeDeck(input);
}
export function encodeDeckCode(input) {
    const bytes = new TextEncoder().encode(JSON.stringify(deckDocument(input)));
    if (bytes.length > MAX_DECK_BYTES)
        throw Error('卡组代码内容不得超过100KB');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return DECK_CODE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Codes contain construction data only. Card rules always come from the server catalog.
export function decodeDeckCode(input) {
    if (typeof input !== 'string' || input.length > MAX_DECK_CODE_LENGTH)
        throw Error('卡组代码为空或过长');
    const text = input.trim();
    if (!text)
        throw Error('请粘贴卡组代码');
    let document;
    if (text.startsWith('{')) {
        if (new TextEncoder().encode(text).length > MAX_DECK_BYTES)
            throw Error('卡组代码内容不得超过100KB');
        try {
            document = JSON.parse(text);
        }
        catch {
            throw Error('卡组 JSON 格式无效');
        }
    }
    else {
        const code = text.replace(/\s/g, '');
        if (!code.startsWith(DECK_CODE_PREFIX))
            throw Error('卡组代码格式无效，请复制组卡页面生成的完整代码');
        const payload = code.slice(DECK_CODE_PREFIX.length);
        if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1)
            throw Error('卡组代码不完整或格式无效');
        try {
            const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
            if (binary.length > MAX_DECK_BYTES)
                throw Error('卡组代码内容不得超过100KB');
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        }
        catch {
            throw Error('卡组代码内容无效，请重新复制完整代码');
        }
    }
    return deckDocument(document);
}
