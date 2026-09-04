import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { StationError } from "@station/observability";

export type Envelope = {
  nonce: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

export type EncryptInput = {
  key: string;
  aad: string;
  plaintext: string;
};

export type DecryptInput = {
  key: string;
  aad: string;
  nonce: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

export function keyBytes(key: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, "hex");
  }
  const raw = Buffer.from(key, "utf8");
  if (raw.length === 32) {
    return raw;
  }
  return createHash("sha256").update(key, "utf8").digest();
}

export function encryptEnvelope(input: EncryptInput): Envelope {
  try {
    const key = keyBytes(input.key);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(input.aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
    return { nonce, tag: cipher.getAuthTag(), ciphertext };
  } catch (err) {
    if (err instanceof StationError) {
      throw err;
    }
    throw new StationError({
      code: "connections.encrypt_failed",
      message: "encrypt failed",
      cause: err,
    });
  }
}

export function decryptEnvelope(input: DecryptInput): string {
  try {
    const key = keyBytes(input.key);
    const decipher = createDecipheriv("aes-256-gcm", key, input.nonce);
    decipher.setAAD(Buffer.from(input.aad, "utf8"));
    decipher.setAuthTag(input.tag);
    return Buffer.concat([decipher.update(input.ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof StationError && err.code !== "connections.encrypt_failed") {
      throw err;
    }
    throw new StationError({
      code: "connections.decrypt_failed",
      message: "decrypt failed",
      cause: err,
    });
  }
}

export function decryptWithRotation(
  input: Omit<DecryptInput, "key">,
  current: string,
  previous?: string,
): string {
  try {
    return decryptEnvelope({ ...input, key: current });
  } catch (first) {
    if (!previous) {
      throw first;
    }
    return decryptEnvelope({ ...input, key: previous });
  }
}

export function connectionAad(id: string, tenantId: string, kind: string): string {
  return `${id}|${tenantId}|${kind}`;
}
