import { createHash } from "crypto";

/**
 * Derives a deterministic Mission ID from the current working directory.
 * This allows agents to implicitly operate within the context of the repository/folder they are running in.
 */
export function getContextMissionId(): string {
    const cwd = process.cwd();
    // Use a hash to ensure a safe, consistent ID string from any path characters
    // Taking first 12 chars is usually sufficient for project ID collision avoidance locally
    const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 12);
    // Prefix to make it readable
    return `mission-${hash}`;
}

/**
 * Derives a human-readable title from the CWD.
 */
export function getContextMissionTitle(): string {
    const cwd = process.cwd();
    // Get the last folder name
    const folderName = cwd.split(/[/\\]/).pop() || "unknown-project";
    return folderName;
}
