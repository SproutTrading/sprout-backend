export function build_response<T>(ok: boolean, data: T, error?: string) {
    return {
        ok,
        error: error ? `${error}` : null,
        data
    }
}