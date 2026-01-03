import { describe, it, expect, afterEach } from "bun:test";
import { missionControlPlugin } from "../../src/index";
import * as fs from "fs";
import * as path from "path";

describe("Plugin Hooks & Setup", () => {
    const configPath = path.join(process.cwd(), "opencode.json");
    let originalConfig: string | null = null;

    // Backup existing config
    const backupConfig = () => {
        if (fs.existsSync(configPath)) {
            originalConfig = fs.readFileSync(configPath, "utf-8");
            fs.unlinkSync(configPath);
        }
    };

    // Restore config
    const restoreConfig = () => {
        if (originalConfig !== null) {
            fs.writeFileSync(configPath, originalConfig);
        } else if (fs.existsSync(configPath)) {
            // If we created it during test and didn't have one before, delete it
            fs.unlinkSync(configPath);
        }
    };

    afterEach(() => {
        restoreConfig();
    });

    it("should block builtin todo tools", async () => {
        const plugin = missionControlPlugin();
        const hook = (plugin as any)["tool.execute.before"];

        expect(hook).toBeDefined();

        // Should block todoread
        await expect(hook({ tool: "todoread" })).rejects.toThrow(/disabled/);

        // Should allow other tools
        await expect(hook({ tool: "mission_control" })).resolves.toBeUndefined();
    });

    it("should auto-create opencode.json if missing", () => {
        backupConfig(); // Ensure file is gone
        expect(fs.existsSync(configPath)).toBe(false);

        // Init plugin
        missionControlPlugin();

        // Check if created
        expect(fs.existsSync(configPath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        expect(content.tools.todoread).toBe(false);
        expect(content.tools.todowrite).toBe(false);
    });
});
