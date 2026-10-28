import prisma from "@/lib/prisma";
// 👆 Our single Prisma instance — never import PrismaClient directly elsewhere

import { generateEmbedding, buildTaskText } from "@/lib/embeddings";
// 👆 Embedding helpers — we need these for createTask and updateTask
// generateEmbedding: calls OpenAI → returns 1536 numbers
// buildTaskText: combines task fields into one searchable string

// ─────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS
// ─────────────────────────────────────────────────────────────────
// Before this refactor, every DB function lived INSIDE agent-chat/route.ts
// The problem: if we ever add a second AI route (e.g. /api/ai/rag-chat),
// it would need the SAME functions — leading to copy-paste code.
//
// The fix: move all shared DB logic here.
// Now agent-chat/route.ts just imports and calls these functions.
// One function, one place — easier to test, easier to update.
// ─────────────────────────────────────────────────────────────────


// ── TYPE DEFINITIONS ─────────────────────────────────────────────
// Narrow string literal types — same as Prisma's generated enums
// Using these here keeps our function signatures self-documenting

export type TaskStatus = "Todo" | "InProgress" | "Done";
// 👆 The three valid status values across the entire app

export type TaskPriority = "High" | "Medium" | "Low";
// 👆 The three valid priority values across the entire app


// ── FUNCTION 1: getTaskStats ──────────────────────────────────────
// Returns total counts by status + priority + completion rate
// Used by: agent-chat (tool: "getTaskStats")
export async function getTaskStats(userId: string) {
    // Fetch counts grouped by BOTH status and priority in one DB round-trip
    // groupBy lets us ask: "how many tasks are Todo+High, InProgress+Medium, etc."
    const taskStatGroups = await prisma.task.groupBy({
        by: ["status", "priority"],
        where: { userId },
        _count: { id: true },
        // 👆 _count.id gives us the number of tasks in each group
    });

    // Get the overall total (ungrouped) — needed for completion rate math
    const totalTasks = await prisma.task.count({
        where: { userId },
    });

    // Add up all Done tasks across every priority level
    const doneTasks = taskStatGroups
        .filter(statGroup => statGroup.status === "Done")
        .reduce((runningTotal, statGroup) => runningTotal + statGroup._count.id, 0);
    // 👆 filter keeps only Done rows, reduce sums up their counts

    // Completion rate = what % of all tasks are Done
    // Guard against division by zero when user has no tasks
    const completionRate = totalTasks > 0
        ? Math.round((doneTasks / totalTasks) * 100)
        : 0;

    return {
        totalTasks,
        completionRate,
        byStatus: {
            // Sum each status group by filtering then reducing
            todo: taskStatGroups
                .filter(statGroup => statGroup.status === "Todo")
                .reduce((runningTotal, statGroup) => runningTotal + statGroup._count.id, 0),
            inProgress: taskStatGroups
                .filter(statGroup => statGroup.status === "InProgress")
                .reduce((runningTotal, statGroup) => runningTotal + statGroup._count.id, 0),
            done: doneTasks,
            // 👆 Reuse the doneTasks count we already calculated above
        },
        byPriority: {
            // Same pattern — filter to one priority, sum the counts
            high: taskStatGroups
                .filter(priorityGroup => priorityGroup.priority === "High")
                .reduce((runningTotal, priorityGroup) => runningTotal + priorityGroup._count.id, 0),
            medium: taskStatGroups
                .filter(priorityGroup => priorityGroup.priority === "Medium")
                .reduce((runningTotal, priorityGroup) => runningTotal + priorityGroup._count.id, 0),
            low: taskStatGroups
                .filter(priorityGroup => priorityGroup.priority === "Low")
                .reduce((runningTotal, priorityGroup) => runningTotal + priorityGroup._count.id, 0),
        }
    };
}


// ── FUNCTION 2: getRecentTasks ────────────────────────────────────
// Returns the most recently created tasks (newest first)
// Used by: agent-chat (tool: "getRecentTasks")
// limit is optional — if omitted, fetch ALL tasks (still ordered newest-first)
export async function getRecentTasks(userId: string, limit?: number) {
    const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        // 👆 Newest tasks first — important for "what did I recently add?" queries
        ...(limit ? { take: limit } : {}),
        // 👆 Spread pattern: only add "take" if a limit was provided
        // Without limit — returns ALL tasks, still sorted newest-first
        select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            description: true,
            createdAt: true,
            // 👆 Select only what OpenAI needs — avoid sending updatedAt etc.
        }
    });

    return { tasks };
}


// ── FUNCTION 3: getAllTasks ───────────────────────────────────────
// Returns ALL tasks with full details — used when AI needs to reason over data
// e.g. "which day do I create the most tasks?" needs ALL rows
// Used by: agent-chat (tool: "getAllTasks")
export async function getAllTasks(userId: string) {
    const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            // 👆 Include updatedAt here — useful for "last modified" queries
        }
    });

    return { totalTasks: tasks.length, tasks };
    // 👆 Include totalTasks in the response so OpenAI can verify the count
}


// ── FUNCTION 4: getTasksByStatus ──────────────────────────────────
// Returns all tasks filtered to one specific status
// Used by: agent-chat (tool: "getTasksByStatus")
export async function getTasksByStatus(userId: string, status: TaskStatus) {
    const tasks = await prisma.task.findMany({
        where: { userId, status },
        // 👆 Both conditions in one where — Prisma applies AND logic automatically
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            title: true,
            priority: true,
            description: true,
            createdAt: true,
        }
    });

    return { status, count: tasks.length, tasks };
    // 👆 Return the status string + count so OpenAI can include them in its answer
}


// ── FUNCTION 5: createTask ────────────────────────────────────────
// Creates a new task AND generates its embedding for RAG search
// Used by: agent-chat (tool: "createTask") AND app/api/tasks POST route
//
// ⭐ Two-step process:
//   Step 1 — Create the task in Postgres (always succeeds or throws)
//   Step 2 — Generate + save embedding (failure here is silently logged)
//   Why? Embedding depends on OpenAI. Task creation must not fail just
//   because OpenAI is slow or errored — the task is more important.
export async function createTask(
    userId: string,
    title: string,
    description?: string,
    priority: TaskPriority = "Medium",
    status: TaskStatus = "Todo"
) {
    // Step 1: Write the task to the database
    const newTask = await prisma.task.create({
        data: {
            title,
            description: description ?? "",
            // 👆 ?? — use empty string if description is undefined/null
            priority,
            status,
            userId,
        },
        select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            createdAt: true,
        }
    });

    // Step 2: Try to generate and save the embedding
    // Wrapped in try/catch so a failure here does NOT undo the task creation
    try {
        const embeddingText = buildTaskText(title, description ?? "", priority, status);
        // 👆 buildTaskText combines all fields into a single searchable sentence
        // e.g. "Fix login bug. Priority: High. Status: Todo. Users can't sign in."

        const embeddingVector = await generateEmbedding(embeddingText);
        // 👆 Calls OpenAI text-embedding-3-small → returns 1536 numbers

        await prisma.$executeRaw`
            UPDATE "Task"
            SET embedding = ${`[${embeddingVector.join(",")}]`}::vector
            WHERE id = ${newTask.id}
        `;
        // 👆 Raw SQL because Prisma doesn't natively support pgvector type
        // ::vector casts our string "[0.1,0.2,...]" to Postgres vector type
    } catch (embeddingError) {
        // Log the error but do NOT re-throw — task was already saved successfully
        console.error("taskService.createTask — embedding failed:", embeddingError);
    }

    return { success: true, task: newTask };
}


// ── FUNCTION 6: updateTask ────────────────────────────────────────
// Updates an existing task's status, priority, or description
// Re-generates embedding after update so RAG search stays accurate
// Used by: agent-chat (tool: "updateTask")
//
// Security: verifies the task belongs to this userId before updating
export async function updateTask(
    userId: string,
    taskId: string,
    status?: TaskStatus,
    priority?: TaskPriority,
    description?: string
) {
    // Security check: confirm this task belongs to the requesting user
    // findFirst returns null if no matching record — never throws
    const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId },
        // 👆 Both id AND userId must match — prevents users editing each other's tasks
    });

    if (!existingTask) {
        // Return a structured error — don't throw, let the caller decide what to do
        return { success: false, error: "Task not found or access denied" };
    }

    // Apply only the fields that were actually provided
    // Spread + conditional = only include a field if it was passed in
    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
            ...(status !== undefined && { status }),
            ...(priority !== undefined && { priority }),
            ...(description !== undefined && { description }),
            // 👆 This pattern means: "if status was passed, include {status: value}"
            // Never accidentally null out a field that wasn't meant to change
        },
        select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            description: true,
        }
    });

    // Re-generate embedding using the LATEST values (after update)
    // If we used old values here, RAG search would return stale results
    try {
        const embeddingText = buildTaskText(
            updatedTask.title,
            updatedTask.description ?? "",
            updatedTask.priority,
            updatedTask.status
        );
        // 👆 Always use updatedTask (post-update values), not existingTask

        const embeddingVector = await generateEmbedding(embeddingText);

        await prisma.$executeRaw`
            UPDATE "Task"
            SET embedding = ${`[${embeddingVector.join(",")}]`}::vector
            WHERE id = ${taskId}
        `;
        // 👆 Overwrites the old embedding — keeps vectors in sync with task data
    } catch (embeddingError) {
        // Log but don't fail — task was already updated successfully
        console.error("taskService.updateTask — embedding failed:", embeddingError);
    }

    return { success: true, task: updatedTask };
}


// ── FUNCTION 7: deleteTask ────────────────────────────────────────
// Deletes a task permanently — cannot be undone
// Used by: agent-chat (tool: "deleteTask")
//
// Security: verifies the task belongs to this userId before deleting
export async function deleteTask(userId: string, taskId: string) {
    // Security check: make sure task exists AND belongs to this user
    const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId },
    });

    if (!existingTask) {
        return { success: false, error: "Task not found or access denied" };
    }

    // Permanently delete from DB — pgvector embedding goes with it
    await prisma.task.delete({
        where: { id: taskId },
    });

    return {
        success: true,
        message: `Task "${existingTask.title}" has been deleted.`,
        // 👆 Include the title in the confirmation message — useful for OpenAI's reply
    };
}
