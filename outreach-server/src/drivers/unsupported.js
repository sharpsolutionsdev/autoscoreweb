export function unsupported(reason) {
    return {
        async send() {
            return { ok: false, error: reason };
        },
    };
}
