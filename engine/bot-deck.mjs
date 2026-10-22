import redMonasteryDeck from '../data/test-decks/red-monastery-bot.json' with { type: 'json' };
import purpleMatriarchDeck from '../data/test-decks/purple-matriarch-bot.json' with { type: 'json' };
import criminalDeck from '../data/test-decks/black-purple-criminal-bot.json' with { type: 'json' };
import shoggothLockingDeck from '../data/test-decks/shoggoth-locking-bot.json' with { type: 'json' };
import blueDragonDeck from '../data/test-decks/blue-dragon-bot.json' with { type: 'json' };
import { encodeDeckCode } from './deck-code.mjs';
import yellowWhiteDeck from '../data/test-decks/yellow-white-bot.json' with { type: 'json' };
import greenBlackDeck from '../data/test-decks/green-black-bot.json' with { type: 'json' };
// The user's supplied HWD1 list, with no substitutions or extra copies.
export const BOT_ID = 'white-anglican';
export const BOT_NAME = '圣公会 BOT';
export const BOT_DECK = { schemaVersion: 1, name: '纯白圣公会（Bot）', societyId: 'MSLC04', cards: [
        ['BH36', 3], ['BQ073', 3], ['XG22', 3], ['XQ28', 3], ['XQ29', 3], ['LC11', 3], ['LC06', 3],
        ['JC081', 3], ['JC080', 3], ['JC078', 3], ['XQ32', 3], ['XQ31', 3], ['XQ33', 3], ['LC08', 3],
        ['JZ47', 2], ['JC076', 3], ['BQ108', 3]
    ].map(([cardId, count]) => ({ cardId, count })), choices: { color: '黄', anchorNames: [], coreId: '' } };
export const BOT_DECK_CODE = encodeDeckCode(BOT_DECK);
export const BOT_PROFILES = [
    { id: BOT_ID, name: BOT_NAME, deck: BOT_DECK, deckCode: BOT_DECK_CODE },
    { id: 'green-black-renown', name: '绿黑速攻 BOT', deck: greenBlackDeck, deckCode: encodeDeckCode(greenBlackDeck) },
    { id: 'yellow-white-spells', name: '黄白法术 BOT', deck: yellowWhiteDeck, deckCode: encodeDeckCode(yellowWhiteDeck) },
    { id: 'blue-dragon-feast', name: '纯蓝龙之欢宴 BOT', deck: blueDragonDeck, deckCode: encodeDeckCode(blueDragonDeck) },
    { id: 'shoggoth-locking', name: '锁定修格斯 BOT', deck: shoggothLockingDeck, deckCode: encodeDeckCode(shoggothLockingDeck) },
    { id: 'red-monastery', name: '纯红隐修会 BOT', deck: redMonasteryDeck, deckCode: encodeDeckCode(redMonasteryDeck) },
    { id: 'purple-matriarch', name: '纯紫主母 BOT', deck: purpleMatriarchDeck, deckCode: encodeDeckCode(purpleMatriarchDeck) },
    { id: 'black-purple-criminals', name: '黑紫罪犯 BOT', deck: criminalDeck, deckCode: encodeDeckCode(criminalDeck) }
];
export const getBotProfile = id => BOT_PROFILES.find(profile => profile.id === id) ?? null;
