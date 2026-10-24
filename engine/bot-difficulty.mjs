// Keep the persisted "normal" identifier for existing games and saves.
export const BOT_DIFFICULTIES = ['normal', 'medium', 'hard'];
export const botDifficultyLabel = d => ({ normal: '简单', medium: '中等', hard: '困难' }[d] ?? '简单');
export const informedBot = s => ['medium', 'hard'].includes(s.bot?.difficulty) && [0, 1].includes(s.bot?.seat) && !!s.players?.[s.bot.seat];
