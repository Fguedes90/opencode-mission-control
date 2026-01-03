import { createHash } from "crypto";
import { getContextMissionTitle } from "./context";

export function generateSmartId(title: string = "mission"): string {
    const prefix = (title.replace(/[^a-zA-Z]/g, '').substring(0, 2) || "mc").toLowerCase();
    const hash = createHash("sha256")
        .update(crypto.randomUUID())
        .digest("hex")
        .substring(0, 4);

    return `${prefix}-${hash}`;
}
