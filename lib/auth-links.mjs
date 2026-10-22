const authPaths = new Set(['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback']);
export function safeRelativeReturnPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
        return '/';
    try {
        const url = new URL(value, 'https://app.local');
        if (url.origin !== 'https://app.local' || authPaths.has(url.pathname))
            return '/';
        return `${url.pathname}${url.search}${url.hash}`;
    }
    catch {
        return '/';
    }
}
export function chatGPTSignInPath(returnTo = '/') {
    return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
export function chatGPTSignOutPath(returnTo = '/') {
    return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
