import { Express } from "express";
import fs from "fs";
import path from "path";

export function registerWellKnownEndpoints(app: Express) {
  app.get("/.well-known/did.json", (req, res) => {
    try {
      let hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
      let host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
      
      if (host.includes("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }

      const didDoc = resolveWellKnownDidDocument(host);
      
      res.json(didDoc);
    } catch (error) {
      console.error("Error serving did.json:", error);
      res.status(500).json({ error: "Failed to serve DID document" });
    }
  });
}

export function resolveWellKnownDidDocument( host: string ) {
      const didPath = path.join(process.cwd(), "server/well-known-did.json");
      let didDoc: any = { id: "" };
      if (fs.existsSync(didPath)) {
        didDoc = JSON.parse(fs.readFileSync(didPath, "utf-8"));
      } else {
        console.warn("well-known-did.json not found, serving minimal DID document");
      }
      didDoc.id = `did:web:${host}`;

      return didDoc;
}
