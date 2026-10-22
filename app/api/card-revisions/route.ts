import { currentCatalog } from '../../../lib/catalog-store';
import { poolAdmin } from '../../../lib/pool-admin';
import { currentPoolSettings } from '../../../lib/pool-settings-store';
import { parseCatalog } from '../../../engine/catalog.mjs';
import { playerCatalog, profileRevisionHistory } from '../../../engine/play-card-profile.mjs';
import { json } from '../rooms/route';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const [doc, policy, admin] = await Promise.all([currentCatalog(), currentPoolSettings(), poolAdmin()]);
        const cards = playerCatalog(parseCatalog(doc.xml), policy.settings).cards;
        const history = profileRevisionHistory(cards, policy.settings);
        if (!admin)
            for (const card of history.cards)
                card.revisions = card.revisions.map(({ note, ...revision }) => revision as typeof card.revisions[number]);
        return json({ ...history, canReviewNotes: !!admin, catalogRevision: doc.revision, poolRevision: policy.revision });
    }
    catch {
        return json({ error: '暂时无法读取卡牌修订记录' }, 503);
    }
}
