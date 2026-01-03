import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getContextMissionId, getContextMissionTitle } from "../../src/utils/context";

describe("getContextMissionId", () => {
    let originalCwd: () => string;

    beforeEach(() => {
        originalCwd = process.cwd;
    });

    afterEach(() => {
        process.cwd = originalCwd;
    });

    it("should generate deterministic ID from cwd", () => {
        process.cwd = () => "/home/user/project";

        const id = getContextMissionId();
        expect(id).toMatch(/^mission-[a-f0-9]{12}$/);
        expect(id.length).toBe(20);

        const id2 = getContextMissionId();
        expect(id2).toBe(id);
    });

    it("should generate different IDs for different cwds", () => {
        process.cwd = () => "/home/user/project1";
        const id1 = getContextMissionId();

        process.cwd = () => "/home/user/project2";
        const id2 = getContextMissionId();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^mission-[a-f0-9]{12}$/);
        expect(id2).toMatch(/^mission-[a-f0-9]{12}$/);
    });
});

describe("getContextMissionTitle", () => {
    let originalCwd: () => string;

    beforeEach(() => {
        originalCwd = process.cwd;
    });

    afterEach(() => {
        process.cwd = originalCwd;
    });

    it("should extract folder name from unix path", () => {
        process.cwd = () => "/home/user/my-project";

        const title = getContextMissionTitle();
        expect(title).toBe("my-project");
    });

    it("should extract folder name from windows path", () => {
        process.cwd = () => "C:\\Users\\user\\my-project";

        const title = getContextMissionTitle();
        expect(title).toBe("my-project");
    });

    it("should handle path ending with separator", () => {
        process.cwd = () => "/home/user/project/";

        const title = getContextMissionTitle();
        expect(title).toBe("unknown-project");
    });

    it("should handle root path", () => {
        process.cwd = () => "/";

        const title = getContextMissionTitle();
        expect(title).toBe("unknown-project");
    });

    it("should handle empty cwd", () => {
        process.cwd = () => "";

        const title = getContextMissionTitle();
        expect(title).toBe("unknown-project");
    });
});