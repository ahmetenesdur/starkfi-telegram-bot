import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
	if (secret.length !== 64) {
		throw new Error("BOT_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)");
	}
	return Buffer.from(secret, "hex");
}

export interface EncryptedData {
	encrypted: Buffer;
	iv: Buffer;
	authTag: Buffer;
}

export function encrypt(plaintext: string, secret: string): EncryptedData {
	const key = deriveKey(secret);
	const iv = randomBytes(IV_LENGTH);

	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return { encrypted, iv, authTag };
}

export function decrypt(data: EncryptedData, secret: string): string {
	const key = deriveKey(secret);

	const decipher = createDecipheriv(ALGORITHM, key, data.iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(data.authTag);

	const decrypted = Buffer.concat([decipher.update(data.encrypted), decipher.final()]);
	return decrypted.toString("utf-8");
}
