import { CycleDetectedError } from "../types/errors";

type Graph = Map<string, string[]>; // blocked_id -> [blocker_ids] or blocker_id -> [blocked_ids] depending on directionality needed. 
// For cycle detection, if we add A -> B (A blocks B), we want to trace if B leads back to A.
// So let's model: node -> [children]. If A blocks B, then A is a parent of B? 
// "Dependency" means Blocker -> Blocked. 
// If I add Blocker -> Blocked, I need to check if there is a path Blocked -> ... -> Blocker.

export class GraphEngine {

    /**
     * Detects if adding a dependency (blocker -> blocked) would create a cycle.
     * @param getDependencies Function that returns the list of blockers for a given task ID.
     * @param blockerId The ID of the task that blocks (parent)
     * @param blockedId The ID of the task being blocked (child)
     */
    async validateNoCycle(
        getDependencies: (taskId: string) => Promise<string[]> | string[],
        blockerId: string,
        blockedId: string
    ): Promise<void> {
        if (blockerId === blockedId) {
            throw new CycleDetectedError(`Task ${blockerId} cannot block itself.`);
        }

        // We need to see if 'blockerId' is already a downstream dependent of 'blockedId'.
        // If blockedId leads to blockerId, then adding blockerId -> blockedId creates a loop.
        // So we search: is 'blockerId' reachable from 'blockedId'?
        // Note: getDependencies usually returns blockers (parents). 
        // If we want to check if Blocked -> ... -> Blocker, we need to traverse DEPENDENTS (children).
        // HOWEVER, if the interface given is `getDependencies` (blockers), we can traverse UPWARDS?
        // Wait. 
        // New Edge: Blocker -> Blocked.
        // Cycle exists if there is already a path Blocked -> ... -> Blocker.
        // This implies Blocked depends on X, which depends on Y ... which depends on Blocker.
        // So we can trace PARENTS (Dependencies) starting from 'blockerId'. 
        // If we find 'blockedId' in the parents of 'blockerId', then 'blockedId' is a prerequisite for 'blockerId'.
        // Thus 'blockerId' cannot be a prerequisite for 'blockedId' (the new edge).

        // CORRECT LOGIC:
        // New link: A (Blocker) -> B (Blocked).
        // Check if B is an ancestor of A. 
        // Traverse GetDependencies(A). If we see B, cycle detected.

        const visited = new Set<string>();
        const queue = [blockerId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const parents = await getDependencies(currentId);
            for (const parentId of parents) {
                if (parentId === blockedId) {
                    throw new CycleDetectedError(`Cycle detected: Task ${blockedId} is already a dependency of ${blockerId}`);
                }
                if (!visited.has(parentId)) {
                    queue.push(parentId);
                }
            }
        }
    }
}
