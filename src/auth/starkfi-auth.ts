import { mkdir, writeFile } from "node:fs/promises";
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
		throw new Error(`Login request failed: ${text}`);
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
		throw new Error(`Verification failed: ${text}`);
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

	await writeFile(join(dataDir, "session.json"), JSON.stringify(session, null, 2), "utf-8");
	logger.info("StarkFi session file written", {
		userHome,
		address: auth.walletAddress,
	});
}
