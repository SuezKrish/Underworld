declare namespace Cloudflare {
    interface Env {
        DB?: D1Database;
        CARD_POOL_ADMIN_USER_ID?: string;
        BUCKET?: R2Bucket;
    }
}
