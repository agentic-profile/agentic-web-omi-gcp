import { Request } from "express";

export interface AppUrlResult {
    host: string;
    url: string;
}

export function appUrl( req: Request ): AppUrlResult {
    const protoHeader = req.headers["x-forwarded-proto"] || "http";
    const protocol = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    
    const url = process.env.APP_URL || `${protocol}://${host}`;
    return { host, url };
}
