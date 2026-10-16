import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedPassword: string) {
  const [algorithm, salt, storedHash] = storedPassword.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return { valid: password === storedPassword, needsRehash: true };
  }

  try {
    const expected = Buffer.from(storedHash, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return {
      valid: expected.length === actual.length && timingSafeEqual(expected, actual),
      needsRehash: false,
    };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
