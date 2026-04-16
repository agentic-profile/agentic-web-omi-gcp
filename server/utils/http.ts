import { Request } from "express";

export function appUrl( req: Request ): string {
    const protoHeader = req.headers["x-forwarded-proto"] || "http";
    const protocol = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    
    return process.env.APP_URL || `${protocol}://${host}`;
}

export function manageChatUrl( req: Request ) {
    return `${appUrl(req)}/chat`;
}