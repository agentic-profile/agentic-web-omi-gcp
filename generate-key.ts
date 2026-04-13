import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';

function generateKey(name: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const jwkPublic = createPublicKey(publicKey).export({ format: 'jwk' });
  const jwkPrivate = createPrivateKey(privateKey).export({ format: 'jwk' });

  console.log(`--- ${name} PUBLIC KEY (JWK) ---`);
  console.log(JSON.stringify(jwkPublic, null, 2));
  console.log(`--- ${name} PRIVATE KEY (JWK) ---`);
  console.log(JSON.stringify(jwkPrivate, null, 2));
  console.log("\n");
}

generateKey("IDENTITY");
generateKey("SYSTEM");
