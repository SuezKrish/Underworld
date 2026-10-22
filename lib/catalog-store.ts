import { env } from 'cloudflare:workers';
import { applyRulings, parseCatalog, catalogXml } from '../engine/catalog.mjs';
import { applyMetadata } from '../engine/metadata.mjs';
import { plainCatalogText } from '../engine/card-text-format.mjs';
import initialXml from '../data/Card.xml?raw';
export { initialXml };
export async function currentCatalog() {
    const doc = await env.DB!.prepare('SELECT xml,revision,updated_at FROM card_documents WHERE id=?').bind('pool').first<{
        xml: string;
        revision: number;
        updated_at: number;
    }>() ?? { xml: initialXml, revision: 0, updated_at: 0 };
    return { ...doc, xml: catalogXml(plainCatalogText(parseCatalog(applyMetadata(applyRulings(doc.xml))))) };
}
