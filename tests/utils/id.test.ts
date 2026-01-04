import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { generateSmartId } from "../../src/utils/id";

describe("generateSmartId", () => {
    it("should generate ID with default title 'mission'", () => {
        const id = generateSmartId();
        expect(id).toMatch(/^mi-[a-f0-9]{8}$/);
        expect(id.length).toBe(11);
    });

    it("should generate ID with custom title", () => {
        const id = generateSmartId("test");
        expect(id).toMatch(/^te-[a-f0-9]{8}$/);
        expect(id.length).toBe(11);
    });

    it("should handle empty title with default prefix", () => {
        const id = generateSmartId("");
        expect(id).toMatch(/^mc-[a-f0-9]{8}$/);
    });

    it("should handle title with special characters", () => {
        const id = generateSmartId("test-123!");
        expect(id).toMatch(/^te-[a-f0-9]{8}$/);
    });

    it("should handle title starting with numbers", () => {
        const id = generateSmartId("123test");
        expect(id).toMatch(/^te-[a-f0-9]{8}$/);
    });

    it("should generate unique IDs on multiple calls", () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateSmartId());
        }
        expect(ids.size).toBe(100);
    });

    it("should be case insensitive for prefix", () => {
        const id1 = generateSmartId("Test");
        const id2 = generateSmartId("TEST");
        expect(id1.substring(0, 2)).toBe("te");
        expect(id2.substring(0, 2)).toBe("te");
    });

    it("should always generate valid format (property-based)", () => {
        fc.assert(
            fc.property(fc.string(), (title) => {
                const id = generateSmartId(title);
                expect(id).toMatch(/^([a-z]{1,2}|mc)-[a-f0-9]{8}$/);
                expect(id.length).toBeGreaterThanOrEqual(10);
                expect(id.length).toBeLessThanOrEqual(11);
            })
        );
    });
});