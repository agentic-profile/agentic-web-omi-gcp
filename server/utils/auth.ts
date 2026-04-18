import { join } from "path";
import {
    type AgenticProfile,
    DID,
    JWKSet,
    parseDid,
    prettyJson,
    createDidResolver
} from "@agentic-profile/common";
//import { loadKeyring } from "@agentic-profile/express-common";
import { ProfileAndKeyring } from "@agentic-profile/auth";
import log from "./log.js";
//import { __dirname } from "./dirname.js";
//import { networkDidResolver } from "./did.js";
import { resolveWellKnownDidDocument } from "../endpoints/wellKnown.ts";

//import systemProfile from "../well-known-did.json" with { type: "json" };
const systemProfile = resolveWellKnownDidDocument("");

const didResolver = createDidResolver();
try {
    const url = process.env.SERVICE_URL || "https://omi.matchwise.ai";
    log.info(`SERVICE_URL: ${url}`);

    const u = new URL(url);
    // did:web encodes ":" in host:port as %3A; URL.hostname drops the port.
    const didWebHost = u.port ? `${u.hostname}%3A${u.port}` : u.hostname;
    systemProfile.id = `did:web:${didWebHost}`;
    log.info(`systemProfile.id: ${systemProfile.id}`);

} catch( err ) {
    log.error(`Failed to parse SERVICE_URL ${process.env.SERVICE_URL} - ${err}`);
}

const PRIVATE_JWK_D_LOG_PREFIX_LEN = 8;

/** For logs only — copies keyring entries with `privateJwk.d` truncated. */
function sanitizeKeyringForLog(keyring: JWKSet[]): unknown[] {
    return keyring.map((entry) => {
        const pj = entry.privateJwk as { d?: string } | undefined;
        const d = pj?.d;
        if (!pj || typeof d !== "string") {
            return entry;
        }
        return {
            ...entry,
            privateJwk: {
                ...pj,
                d: `${d.slice(0, PRIVATE_JWK_D_LOG_PREFIX_LEN)}…`,
            },
        };
    });
}

const keyring: JWKSet[] = [];
const PRIVATE_KEYS = {
    "#system-key": process.env.SYSTEM_PRIVATE_KEY,
    "#identity-key": process.env.IDENTITY_PRIVATE_KEY
}
for( const { id, publicKeyJwk } of systemProfile.verificationMethod ) {
  const b64uPrivateKey = PRIVATE_KEYS[id]
  keyring.push({
    id,
    publicJwk: publicKeyJwk,
    b64uPublicKey: publicKeyJwk.x,
    privateJwk: {
        ...publicKeyJwk,
        d: b64uPrivateKey
    },
    b64uPrivateKey
  })
}

export type ProfileResolver = ( did: DID ) => Promise<ProfileAndKeyring>;

export interface CreateProfileResolverResult {
    profileResolver: ProfileResolver,
    systemProfileAndKeyring: ProfileAndKeyring
}

export async function createProfileResolver( did: DID ): Promise<CreateProfileResolverResult> {
    // "regular" user (me!)
    const didResolution = await didResolver.resolve( did );
    const myProfile = didResolution.didDocument as AgenticProfile;
    if( !myProfile )
        throw new Error(`Failed to resolve agentic profile ${did}: ${prettyJson(didResolution)}`);
    const myProfileAndKeyring: ProfileAndKeyring = {
        profile: myProfile,
        keyring: []
    };

    // system account, to handle #system-key verifications from users
    // utils -> common -> src|dist -> server package root (where keyring.json lives)
    //const keyring = await loadKeyring( join( __dirname, "..", "..", ".." ) );
    const systemProfileAndKeyring: ProfileAndKeyring = {
        profile: systemProfile as unknown as AgenticProfile,
        keyring
    };

    const profiles = [ 
        myProfileAndKeyring,
        systemProfileAndKeyring
    ];

    const profileResolver = async ( did: DID ): Promise<ProfileAndKeyring> => {
        const targetId = parseDid( did ).did;
        const found = profiles.find( e=>e.profile.id === targetId );
        if( !found ) {
            log.info("Failed to resolve agentic profile", prettyJson({
                did,
                targetId,
                profiles: profiles.map((p) => ({
                    profileId: p.profile.id,
                    keyring: sanitizeKeyringForLog(p.keyring),
                })),
            }));
            throw new Error(`Failed to resolve agentic profile ${did}`);
        }

        return found;
    };

    return { profileResolver, systemProfileAndKeyring };
}
