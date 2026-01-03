import { describe, it, expect, afterEach } from "bun:test";
import { missionControlPlugin } from "../../src/index";
import * as fs from "fs";
import * as path from "path";

describe("Plugin Hooks & Setup", () => {
    const configPath = path.join(process.cwd(), "opencode.json");
    let originalConfig: string | null = null;

    
    const backupConfig = () => {
        if (fs.existsSync(configPath)) {
            originalConfig = fs.readFileSync(configPath, "utf-8");
            fs.unlinkSync(configPath);
        }
    };

    
    const restoreConfig = () => {
        if (originalConfig !== null) {
            fs.writeFileSync(configPath, originalConfig);
        } else if (fs.existsSync(configPath)) {
            
            fs.unlinkSync(configPath);
        }
    };

    afterEach(() => {
        restoreConfig();
    });

    it("should block builtin todo tools", async () => {
        const plugin = await missionControlPlugin();
        const hook = plugin.hooks["tool.execute.before"];

        expect(hook).toBeDefined();

        
        await expect(hook({ tool: "todoread" })).rejects.toThrow(/disabled/);

        
        await expect(hook({ tool: "mission_control" })).resolves.toBeUndefined();
    });

    it("should auto-create opencode.json if missing", async () => {
        backupConfig();
        expect(fs.existsSync(configPath)).toBe(false);


        await missionControlPlugin();

        
        expect(fs.existsSync(configPath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        expect(content.tools.todoread).toBe(false);
        expect(content.tools.todowrite).toBe(false);
    });
});
