import { createDecipheriv } from "node:crypto";
import Database from "better-sqlite3";
import type { ModelMessage } from "ai";
import { encrypt, decrypt } from "./crypto.js";
import type { Provider, UserSession } from "./types.js";
import { logger } from "../lib/logger.js";

function safeParseHistory(raw: string): ModelMessage[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		logger.warn("Corrupt history data — resetting to empty");
		return [];
	}
}

export class SessionStore {
	private db: Database.Database;
	private stmts!: ReturnType<SessionStore["prepareStatements"]>;

	constructor(dbPath: string, encryptionSecret?: string) {
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.db.pragma("busy_timeout = 5000");
		this.init(encryptionSecret);
	}

	private init(encryptionSecret?: string): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				user_id       TEXT PRIMARY KEY,
				provider      TEXT NOT NULL,
				api_key_enc   TEXT NOT NULL,
				model_name    TEXT NOT NULL,
				starkfi_addr  TEXT,
				history       TEXT NOT NULL DEFAULT '[]',
				updated_at    INTEGER DEFAULT (unixepoch())
			)
		`);

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS auth_states (
				user_id    TEXT PRIMARY KEY,
				step       TEXT NOT NULL,
				email      TEXT,
				data       TEXT,
				updated_at INTEGER DEFAULT (unixepoch())
			)
		`);

		this.migrateIfNeeded(encryptionSecret);
		this.stmts = this.prepareStatements();
		logger.info("Session store initialized");
	}

	/** Decrypt API key using old 16-byte IV format (pre-migration) */
	private static decryptOldFormat(
		iv: Buffer,
		authTag: Buffer,
		encrypted: Buffer,
		secret: string
	): string {
		const key = Buffer.from(secret, "hex");
		const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
		decipher.setAuthTag(authTag);
		return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
	}

	/** Migrate from old 3-BLOB schema to single TEXT column if needed */
	private migrateIfNeeded(encryptionSecret?: string): void {
		const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];

		const colNames = columns.map((c) => c.name);

		// Old schema has 'encrypted_key' BLOB column; new schema has 'api_key_enc' TEXT
		if (colNames.includes("encrypted_key") && !colNames.includes("api_key_enc")) {
			if (!encryptionSecret) {
				throw new Error("encryptionSecret is required to migrate from old schema");
			}

			logger.info("Migrating session store from BLOB to TEXT schema");

			const oldRows = this.db
				.prepare(
					"SELECT user_id, provider, encrypted_key, iv, auth_tag, model_name, starkfi_addr, history FROM sessions"
				)
				.all() as {
				user_id: string;
				provider: string;
				encrypted_key: Buffer;
				iv: Buffer;
				auth_tag: Buffer;
				model_name: string;
				starkfi_addr: string | null;
				history: string;
			}[];

			// Drop old tables and recreate
			this.db.exec("DROP TABLE IF EXISTS sessions");
			this.db.exec("DROP TABLE IF EXISTS auth_states");

			this.db.exec(`
				CREATE TABLE sessions (
					user_id       TEXT PRIMARY KEY,
					provider      TEXT NOT NULL,
					api_key_enc   TEXT NOT NULL,
					model_name    TEXT NOT NULL,
					starkfi_addr  TEXT,
					history       TEXT NOT NULL DEFAULT '[]',
					updated_at    INTEGER DEFAULT (unixepoch())
				)
			`);

			this.db.exec(`
				CREATE TABLE auth_states (
					user_id    TEXT PRIMARY KEY,
					step       TEXT NOT NULL,
					email      TEXT,
					data       TEXT,
					updated_at INTEGER DEFAULT (unixepoch())
				)
			`);

			// Decrypt with old format (16-byte IV), re-encrypt with new format (12-byte IV)
			if (oldRows.length > 0) {
				const insert = this.db.prepare(
					"INSERT INTO sessions (user_id, provider, api_key_enc, model_name, starkfi_addr, history) VALUES (?, ?, ?, ?, ?, ?)"
				);

				const migrate = this.db.transaction(() => {
					for (const row of oldRows) {
						try {
							const plainKey = SessionStore.decryptOldFormat(
								row.iv,
								row.auth_tag,
								row.encrypted_key,
								encryptionSecret
							);
							const newEncrypted = encrypt(plainKey, encryptionSecret);
							insert.run(
								row.user_id,
								row.provider,
								newEncrypted,
								row.model_name,
								row.starkfi_addr,
								row.history
							);
						} catch (err) {
							logger.warn("Failed to migrate session — skipping", {
								userId: row.user_id,
								error: err instanceof Error ? err.message : String(err),
							});
						}
					}
				});

				migrate();
				logger.info("Migration complete", { migratedSessions: oldRows.length });
			}
		}
	}

	private prepareStatements() {
		return {
			getSession: this.db.prepare(
				"SELECT user_id, provider, api_key_enc, model_name, starkfi_addr, history FROM sessions WHERE user_id = ?"
			),
			upsertSession: this.db.prepare(
				`INSERT INTO sessions (user_id, provider, api_key_enc, model_name, history)
				 VALUES (?, ?, ?, ?, '[]')
				 ON CONFLICT(user_id) DO UPDATE SET
				   provider = excluded.provider,
				   api_key_enc = excluded.api_key_enc,
				   model_name = excluded.model_name,
				   updated_at = unixepoch()`
			),
			updateAddr: this.db.prepare(
				"UPDATE sessions SET starkfi_addr = ?, updated_at = unixepoch() WHERE user_id = ?"
			),
			updateHistory: this.db.prepare(
				"UPDATE sessions SET history = ?, updated_at = unixepoch() WHERE user_id = ?"
			),
			updateModel: this.db.prepare(
				"UPDATE sessions SET model_name = ?, updated_at = unixepoch() WHERE user_id = ?"
			),
			clearHistory: this.db.prepare(
				"UPDATE sessions SET history = '[]', updated_at = unixepoch() WHERE user_id = ?"
			),
			deleteSession: this.db.prepare("DELETE FROM sessions WHERE user_id = ?"),
			getAuthState: this.db.prepare(
				"SELECT step, email, data FROM auth_states WHERE user_id = ?"
			),
			setAuthState: this.db.prepare(
				`INSERT INTO auth_states (user_id, step, email, data)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(user_id) DO UPDATE SET
				   step = excluded.step,
				   email = excluded.email,
				   data = excluded.data,
				   updated_at = unixepoch()`
			),
			clearAuthState: this.db.prepare("DELETE FROM auth_states WHERE user_id = ?"),
		};
	}

	get(userId: string): UserSession | null {
		const row = this.stmts.getSession.get(userId) as Record<string, unknown> | undefined;
		if (!row) return null;

		return {
			userId: row.user_id as string,
			provider: row.provider as Provider,
			encryptedApiKey: row.api_key_enc as string,
			modelName: row.model_name as string,
			starkfiAddr: (row.starkfi_addr as string) ?? null,
			history: safeParseHistory((row.history as string) || "[]"),
		};
	}

	upsert(userId: string, provider: Provider, encryptedApiKey: string, modelName: string): void {
		this.stmts.upsertSession.run(userId, provider, encryptedApiKey, modelName);
	}

	decryptApiKey(session: UserSession, secret: string): string {
		return decrypt(session.encryptedApiKey, secret);
	}

	updateStarkfiAddr(userId: string, address: string): void {
		this.stmts.updateAddr.run(address, userId);
	}

	updateHistory(userId: string, history: ModelMessage[], maxHistory: number): void {
		const trimmed = history.slice(-maxHistory);
		this.stmts.updateHistory.run(JSON.stringify(trimmed), userId);
	}

	clearHistory(userId: string): void {
		this.stmts.clearHistory.run(userId);
	}

	updateModelName(userId: string, modelName: string): void {
		this.stmts.updateModel.run(modelName, userId);
	}

	deleteApiKey(userId: string): void {
		this.stmts.deleteSession.run(userId);
	}

	// ── Auth state management ──

	getAuthState(userId: string): string | null {
		const row = this.stmts.getAuthState.get(userId) as Record<string, unknown> | undefined;
		if (!row) return null;

		// Reconstruct full state: merge step/email with extra JSON from data column
		const base: Record<string, unknown> = { step: row.step };
		if (row.email) base.email = row.email;
		if (row.data) {
			try {
				Object.assign(base, JSON.parse(row.data as string));
			} catch {
				/* ignore corrupt data */
			}
		}
		return JSON.stringify(base);
	}

	setAuthState(userId: string, state: string): void {
		const parsed = JSON.parse(state) as Record<string, unknown>;
		const step = parsed.step as string;
		const email = (parsed.email as string) ?? null;

		// Store step/email in dedicated columns, everything else in data as JSON
		const { step: _s, email: _e, ...extra } = parsed;
		const data = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

		this.stmts.setAuthState.run(userId, step, email, data);
	}

	clearAuthState(userId: string): void {
		this.stmts.clearAuthState.run(userId);
	}

	close(): void {
		this.db.close();
	}
}
