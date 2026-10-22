import {compareCardOrder} from '../../../engine/card-order.mjs';
import { env } from 'cloudflare:workers';
import { initialXml, currentCatalog as current } from '../../../lib/catalog-store';
import { poolAdmin } from '../../../lib/pool-admin';
import { currentPoolSettings, updatePoolSettings } from '../../../lib/pool-settings-store';
import { plainCatalogText, splitCardRules } from '../../../engine/card-text-format.mjs';
import { parseCatalog, catalogXml, catalogSubset, editCatalog } from '../../../engine/catalog.mjs';
import { cardAvailability, enabledCards, poolSetSummary } from '../../../engine/card-pool.mjs';
import { playerCatalog, profileCardVariant } from '../../../engine/play-card-profile.mjs';
import { auditCatalog } from '../../../engine/audit.mjs';
import { metadataFor, metadataReport } from '../../../engine/metadata.mjs';
import { environmentStatus } from '../../../engine/environment-definitions.mjs';
import societySources from '../../../data/society-construction.json';
import { json, sameOrigin } from '../rooms/route';
export const dynamic = 'force-dynamic';
function visibleCatalog(doc: any, policy: any, manage: boolean) { const catalog = parseCatalog(doc.xml); return manage ? catalog : catalogSubset(catalog, new Set(enabledCards(catalog.cards, policy.settings).map((c: any) => c.id))); }
function payload(doc: any, policy: any, admin: boolean, play = false) {
    const manage = admin && !play, parsed = visibleCatalog(doc, policy, manage), audit = auditCatalog(parsed.cards, parseCatalog(initialXml).cards), summary = metadataReport().summary;
    return { ...audit, auditAssumptions: manage ? audit.auditAssumptions : audit.auditAssumptions.slice(0, 4), cards: audit.cards.map((source: any) => {
            const card = manage ? source : profileCardVariant(source, policy.settings), environment = source.type === '秘社' ? environmentStatus(source) : null;
            return { ...card, ...splitCardRules(card.text), ...(manage ? { availability: cardAvailability(source, policy.settings), metadata: metadataFor(source) } : {}), constructionRuleSource: societySources.find(s => s.id === card.id), environmentAudit: environment ? { implemented: environment.implemented, reason: environment.reason } : undefined };
        }).sort(compareCardOrder), canManagePool: admin, metadataSummary: manage ? summary : { matchedCards: parsed.cards.length, uniqueCards: parsed.cards.filter((c: any) => c.unique === 1).length, subtitles: parsed.cards.filter((c: any) => c.subtitle).length, flavors: parsed.cards.filter((c: any) => c.flavorText).length }, ...(manage ? { poolManagement: { ...policy, sets: poolSetSummary(parseCatalog(doc.xml).cards, policy.settings) } } : {}), sets: parsed.sets, worldCardCount: parsed.cards.filter((c: any) => c.type === '地区').length, revision: doc.revision, poolRevision: policy.revision, updatedAt: doc.updated_at, removed: parsed.removed };
}
function download(value: string, type: string, name: string) { return new Response(value, { headers: { 'Content-Type': type + '; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } }); }
export async function GET(request: Request) {
    try {
        const [doc, policy, admin] = await Promise.all([current(), currentPoolSettings(), poolAdmin()]), url = new URL(request.url), format = url.searchParams.get('format'), play = url.searchParams.get('scope') === 'play';
        if (format === 'metadata') {
            if (!admin)
                return json({ error: '仅卡牌池管理员可查看来源核对资料' }, 403);
            return download(JSON.stringify(metadataReport(), null, 2), 'application/json', 'Card.metadata.json');
        }
        if (format === 'xml')
            return download(catalogXml(admin && !play ? parseCatalog(doc.xml) : playerCatalog(parseCatalog(doc.xml), policy.settings)), 'application/xml', 'Card.modified.xml');
        const p = payload(doc, policy, admin, play);
        if (format === 'blockers')
            return download(JSON.stringify({ total: p.cards.length, implemented: p.auditCounts.automated, categories: p.blockerCounts, cards: p.cards.filter((c: any) => !c.audit.implemented).map((c: any) => ({ id: c.id, name: c.name, ...(c.audit.blocker ?? { category: '待重审', reason: c.audit.reason, decision: '审核修改后的资料再实现。', quote: c.text }) })) }, null, 2), 'application/json', 'Card.blockers.json');
        if (format === 'audit')
            return download(JSON.stringify(p, null, 2), 'application/json', 'Card.audit.json');
        return json(p);
    }
    catch {
        return json({ error: '暂时无法读取卡牌池' }, 503);
    }
}
export async function POST(request: Request) {
    try {
        sameOrigin(request);
        if (!await poolAdmin())
            return json({ error: '仅卡牌池管理员可以修改卡牌资料与启用设置' }, 403);
        if (Number(request.headers.get('content-length')) > 1800000)
            return json({ error: '文件过大' }, 413);
        const body = await request.json() as any, doc = await current();
        if (body.revision !== doc.revision)
            return json({ error: '卡牌池已更新，请刷新后重试' }, 409);
        if (['set-card-availability', 'set-set-availability'].includes(body.type)) {
            const policy = await updatePoolSettings(parseCatalog(doc.xml).cards, body);
            return json(payload(doc, policy, true));
        }
        let catalog;
        if (body.type === 'import')
            catalog = parseCatalog(body.xml);
        else if (body.type === 'edit')
            catalog = editCatalog(parseCatalog(doc.xml), body.cardId, body);
        else
            return json({ error: '不支持的操作' }, 400);
        catalog = plainCatalogText(catalog);
        const xml = catalogXml(catalog);
        parseCatalog(xml);
        await env.DB!.prepare('INSERT OR IGNORE INTO card_documents (id,xml,revision,updated_at) VALUES (?,?,0,0)').bind('pool', initialXml).run();
        const now = Date.now(), result = await env.DB!.prepare('UPDATE card_documents SET xml=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(xml, now, 'pool', doc.revision).run();
        if (!result.meta.changes)
            return json({ error: '卡牌池已更新，请刷新后重试' }, 409);
        return json({ ...payload({ xml, revision: doc.revision + 1, updated_at: now }, await currentPoolSettings(), true), removed: catalog.removed });
    }
    catch (e) {
        const error = e instanceof Error ? e.message : '卡牌池更新失败';
        return json({ error }, error.includes('已更新') ? 409 : 400);
    }
}
