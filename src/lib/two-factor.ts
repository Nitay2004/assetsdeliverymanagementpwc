import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = "DevIT";
const CIPHER = "aes-256-gcm";
const IV_BYTES = 12;
const TOTP_STEP_SECONDS = 30;
// Authenticator apps normally need +/-1 step, but the machines this app runs on
// are frequently minutes out of sync with real time (unsynced CMOS clock, no NTP
// available), which makes a strict window reject perfectly valid codes. Measured
// skew on STAGE-APP1 was ~345s, so tolerance is +/-600s (10 minutes) to cover it.
// The trade-off is that a captured code stays usable for ~20 minutes instead of
// 30 seconds — mitigated by the 5-attempt limit on the verification endpoint and
// by the replay guard below (a matched step can never be reused).
const TOTP_EPOCH_TOLERANCE_SECONDS = 600;
export const RECOVERY_CODE_COUNT = 10;

// Crockford-ish alphabet: no I/L/O/U/0/1, so codes are unambiguous when read
// off a screen and typed by hand.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function getEncryptionKey(): Buffer {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

export function createTotpSecret(): string {
  return generateSecret();
}

// Stored as "<iv>.<tag>.<ciphertext>" (base64url) so a stolen DB dump alone does
// not hand over working 2FA secrets.
export function encryptTotpSecret(plainSecret: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(stored: string): string {
  const [ivPart, tagPart, dataPart] = stored.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed 2FA secret");
  }
  const decipher = crypto.createDecipheriv(CIPHER, getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function buildOtpAuthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function buildOtpQrDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export type TotpVerifyResult =
  | { ok: true; timeStep: bigint }
  | { ok: false; reason: "format" | "invalid" | "replayed" };

// The matched time step is recorded on the user so a captured code cannot be
// replayed for the whole window it stays valid for.
export function verifyTotp(
  token: string,
  secret: string,
  lastTimeStep: bigint | number | null
): TotpVerifyResult {
  const code = token.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "format" };

  let result: { valid: boolean; epoch?: number };
  try {
    result = verifySync({
      token: code,
      secret,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
  } catch {
    return { ok: false, reason: "format" };
  }

  if (!result.valid || typeof result.epoch !== "number") {
    return { ok: false, reason: "invalid" };
  }

  // `epoch` is the start of the period the code matched, so the replay guard
  // stores the exact step the token belonged to.
  const timeStep = BigInt(Math.floor(result.epoch / TOTP_STEP_SECONDS));
  if (lastTimeStep !== null && lastTimeStep !== undefined && timeStep <= BigInt(lastTimeStep)) {
    return { ok: false, reason: "replayed" };
  }

  return { ok: true, timeStep };
}

export function currentTotpTimeStep(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS));
}

function randomRecoveryCode(): string {
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += "-";
  }
  return out;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = randomRecoveryCode();
    codes.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { codes, hashes };
}

// sha256 over a 16-char, 32-symbol code is ~2^80 of entropy, so an offline
// attack against a leaked hash table is not practical.
export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(`devit-2fa-recovery:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

export function isRecoveryCodeShaped(code: string): boolean {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== 16) return false;
  for (const ch of normalized) {
    if (!RECOVERY_ALPHABET.includes(ch)) return false;
  }
  return true;
}
