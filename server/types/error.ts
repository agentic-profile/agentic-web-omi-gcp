/**
 * High-level server error classification for HTTP and JSON-RPC mapping.
 */
export type ServerErrorKind =
    | "MalformedRequest"
    | "InvalidParameters"
    | "Conflict"
    | "Unauthorized"
    | "Forbidden"
    | "ServiceUnavailable";

export type ServerErrorOptions = {
    kind: ServerErrorKind;
    message: string;
    id?: string | number | null;
    /** Optional structured payload (included in JSON-RPC `error.data` and HTTP body). */
    details?: Record<string, unknown>;
    cause?: unknown;
};

/**
 * Throwable server error: same instance can be turned into a JSON-RPC 2.0 error
 * response or a regular HTTP JSON body + status, depending on transport.
 */
export class ServerError extends Error {
    public readonly kind: ServerErrorKind;
    public readonly id?: string | number | null;
    public readonly details?: Record<string, unknown>;

    constructor(opts: ServerErrorOptions) {
        super(opts.message, { cause: opts.cause });
        this.name = "ServerError";
        this.kind = opts.kind;
        this.id = opts.id;
        this.details = opts.details;
    }
}

export function isServerError(err: unknown): err is ServerError {
    return err instanceof ServerError;
}

// HTTP herlpers

export function describeServerError(error: ServerError) {
    return {
        kind: error.kind,
        error: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
    };
}

export function resolveServerErrorHttpStatus(error: ServerError) {
    switch (error.kind) {
        case "MalformedRequest":
            return 400;
        case "InvalidParameters":
            return 400;
        case "Unauthorized":
            return 401;
        case "Forbidden":
            return 403;
        case "Conflict":
            return 409;
        case "ServiceUnavailable":
            return 503;
        default:
            return 500;
    }
}
