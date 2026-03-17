import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../lib/logger.js";

export interface StarkfiAuthResult {
	userId: string;
	walletId: string;
	walletAddress: string;
	walletPublicKey: string;
	token: string;
}

export async function requestLogin(serverUrl: string, email: string): Promise<void> {
	const res = await fetch(`${serverUrl}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email }),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		logger.error("StarkFi login request failed", {
			status: res.status,
			body: text,
		});
		throw new Error(`Login request failed. Please try again.`);
	}
}

export async function verifyOtp(
	serverUrl: string,
	email: string,
	code: string
): Promise<StarkfiAuthResult> {
	const res = await fetch(`${serverUrl}/auth/verify`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, code }),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		logger.error("StarkFi OTP verification failed", {
			status: res.status,
			body: text,
		});
		throw new Error(`Verification failed. Please check your code and try again.`);
	}

	return (await res.json()) as StarkfiAuthResult;
}

// Platform-specific data directory for isolated user HOMEs
function getStarkfiDataDir(userHome: string): string {
	if (process.platform === "darwin") {
		return join(userHome, "Library", "Application Support", "starkfi-nodejs");
	}
	if (process.platform === "win32") {
		return join(userHome, "AppData", "Local", "starkfi-nodejs", "Data");
	}
	return join(userHome, ".local", "share", "starkfi-nodejs");
}

export async function writeSessionFile(
	userHome: string,
	auth: StarkfiAuthResult,
	serverUrl: string,
	network: "mainnet" | "sepolia" = "mainnet"
): Promise<void> {
	const dataDir = getStarkfiDataDir(userHome);
	await mkdir(dataDir, { recursive: true });

	const session = {
		type: "privy",
		network,
		address: auth.walletAddress,
		userId: auth.userId,
		walletId: auth.walletId,
		publicKey: auth.walletPublicKey,
		token: auth.token,
		serverUrl,
	};

	const sessionPath = join(dataDir, "session.json");
	await writeFile(sessionPath, JSON.stringify(session, null, 2), "utf-8");

	// Debug: verify the file was actually written
	try {
		const stats = await stat(sessionPath);
		logger.info("StarkFi session file written", {
			userHome,
			dataDir,
			sessionPath,
			fileSize: stats.size,
			address: auth.walletAddress,
		});
	} catch (e) {
		logger.error("Session file write verification FAILED", {
			sessionPath,
			error: e instanceof Error ? e.message : String(e),
		});
	}
}
