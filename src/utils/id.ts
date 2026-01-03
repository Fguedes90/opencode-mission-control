import { createHash } from "crypto";
import { getContextMissionTitle } from "./context";

/**
 * Generates a "Smart ID" in the format: prefix-hash
 * Example: "mc-a1b2c3"
 * 
 * Prefix is derived from the mission title (first 2 chars).
 * Hash is derived from random entropy but truncated for readability.
 */
export function generateSmartId(title: string = "mission"): string {
    const prefix = (title.replace(/[^a-zA-Z]/g, '').substring(0, 2) || "mc").toLowerCase();
    const hash = createHash("sha256")
        .update(crypto.randomUUID())
        .digest("hex")
        .substring(0, 4);

    return `${prefix}-${hash}`;
}
