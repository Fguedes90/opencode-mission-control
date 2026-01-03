import { createHash } from "crypto";

export function getContextMissionId(): string {
    const cwd = process.cwd();
    const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 12);
    return `mission-${hash}`;
}

export function getContextMissionTitle(): string {
    const cwd = process.cwd();
    const folderName = cwd.split(/[/\\]/).pop() || "unknown-project";
    return folderName;
}
