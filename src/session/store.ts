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
	private encryptionSecret: string;
	private stmts!: ReturnType<SessionStore["prepareStatements"]>;

	constructor(dbPath: string, encryptionSecret: string) {
		this.encryptionSecret = encryptionSecret;
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.init();
	}

	private init(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				user_id       TEXT PRIMARY KEY,
				provider      TEXT NOT NULL,
				encrypted_key BLOB NOT NULL,
				iv            BLOB NOT NULL,
				auth_tag      BLOB NOT NULL,
				model_name    TEXT NOT NULL,
				starkfi_addr  TEXT,
				history       TEXT NOT NULL DEFAULT '[]',
				created_at    INTEGER NOT NULL,
				updated_at    INTEGER NOT NULL
			)
		`);

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS auth_states (
				user_id TEXT PRIMARY KEY,
				state   TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		this.stmts = this.prepareStatements();
		logger.info("Session store initialized");
	}

	private prepareStatements() {
		return {
			getSession: this.db.prepare(
				`SELECT user_id, provider, encrypted_key, iv, auth_tag,
				        model_name, starkfi_addr, history, created_at, updated_at
				 FROM sessions WHERE user_id = ?`
			),
			upsertSession: this.db.prepare(
				`INSERT INTO sessions (user_id, provider, encrypted_key, iv, auth_tag, model_name, history, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
				 ON CONFLICT(user_id) DO UPDATE SET
				   provider = excluded.provider,
				   encrypted_key = excluded.encrypted_key,
				   iv = excluded.iv,
				   auth_tag = excluded.auth_tag,
				   model_name = excluded.model_name,
				   updated_at = excluded.updated_at`
			),
			updateAddr: this.db.prepare(
				`UPDATE sessions SET starkfi_addr = ?, updated_at = ? WHERE user_id = ?`
			),
			updateHistory: this.db.prepare(
				`UPDATE sessions SET history = ?, updated_at = ? WHERE user_id = ?`
			),
			updateModel: this.db.prepare(
				`UPDATE sessions SET model_name = ?, updated_at = ? WHERE user_id = ?`
			),
			clearHistory: this.db.prepare(
				`UPDATE sessions SET history = '[]', updated_at = ? WHERE user_id = ?`
			),
			deleteSession: this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`),
			getAuthState: this.db.prepare(`SELECT state FROM auth_states WHERE user_id = ?`),
			setAuthState: this.db.prepare(
				`INSERT INTO auth_states (user_id, state, updated_at) VALUES (?, ?, ?)
				 ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
			),
			clearAuthState: this.db.prepare(`DELETE FROM auth_states WHERE user_id = ?`),
		};
	}

	get(userId: string): UserSession | null {
		const row = this.stmts.getSession.get(userId) as SessionRow | undefined;
		if (!row) return null;

		return {
			userId: row.user_id,
			provider: row.provider as Provider,
			encryptedKey: row.encrypted_key,
			iv: row.iv,
			authTag: row.auth_tag,
			modelName: row.model_name,
			starkfiAddr: row.starkfi_addr,
			history: safeParseHistory(row.history),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	upsert(userId: string, provider: Provider, apiKey: string, modelName: string): void {
		const { encrypted, iv, authTag } = encrypt(apiKey, this.encryptionSecret);
		const now = Date.now();
		this.stmts.upsertSession.run(userId, provider, encrypted, iv, authTag, modelName, now, now);
	}

	decryptApiKey(session: UserSession): string {
		return decrypt(
			{
				encrypted: session.encryptedKey,
				iv: session.iv,
				authTag: session.authTag,
			},
			this.encryptionSecret
		);
	}

	updateStarkfiAddr(userId: string, address: string): void {
		this.stmts.updateAddr.run(address, Date.now(), userId);
	}

	updateHistory(userId: string, history: ModelMessage[], maxHistory: number): void {
		const trimmed = history.slice(-maxHistory);
		this.stmts.updateHistory.run(JSON.stringify(trimmed), Date.now(), userId);
	}

	clearHistory(userId: string): void {
		this.stmts.clearHistory.run(Date.now(), userId);
	}

	updateModelName(userId: string, modelName: string): void {
		this.stmts.updateModel.run(modelName, Date.now(), userId);
	}

	deleteApiKey(userId: string): void {
		this.stmts.deleteSession.run(userId);
	}

	getAuthState(userId: string): string | null {
		const row = this.stmts.getAuthState.get(userId) as { state: string } | undefined;
		return row?.state ?? null;
	}

	setAuthState(userId: string, state: string): void {
		this.stmts.setAuthState.run(userId, state, Date.now());
	}

	clearAuthState(userId: string): void {
		this.stmts.clearAuthState.run(userId);
	}

	close(): void {
		this.db.close();
	}
}

interface SessionRow {
	user_id: string;
	provider: string;
	encrypted_key: Buffer;
	iv: Buffer;
	auth_tag: Buffer;
	model_name: string;
	starkfi_addr: string | null;
	history: string;
	created_at: number;
	updated_at: number;
}
