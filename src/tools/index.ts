import { mission_control } from "./implementations/mission_control.ts";
import { MissionManager } from "../core/MissionManager.ts";

export const registerTools = (manager: MissionManager) => {
    return [
        mission_control
    ].map((tool: any) => ({
        ...tool,
        handler: (args: any) => tool.handler(manager, args)
    }));
};
