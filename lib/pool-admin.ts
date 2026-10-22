import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { isPoolAdmin } from '../engine/card-pool.mjs';
export async function poolAdmin() { return isPoolAdmin(await getChatGPTUser(), (env as any).CARD_POOL_ADMIN_USER_ID); }
