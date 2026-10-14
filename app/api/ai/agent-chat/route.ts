import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ── Tool definitions — we tell OpenAI what functions exist ──
// OpenAI reads these descriptions and decides which one to call
const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "getTaskStats",
            description: "Get total task counts grouped by status (Todo, InProgress, Done) and priority (High, Medium, Low). Use this for questions about counts, completion rate, progress overview, or how many tasks exist.",
            parameters: {
                type: "object",
                properties: {},
                // 👆 No parameters needed — userId comes from the session
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getRecentTasks",
            description: "Get the most recently created tasks with their title, status, priority and description. Use this for questions about recent work, latest tasks, or what was added recently.",
            parameters: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "How many recent tasks to fetch. Default is 5."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getTasksByStatus",
            description: "Get all tasks filtered by a specific status. Use this when user asks about Todo tasks, InProgress tasks, or Done/completed tasks specifically.",
            parameters: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        enum: ["Todo", "InProgress", "Done"],
                        description: "The status to filter by"
                    }
                },
                required: ["status"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createTask",
            description: "Create a new task with a title, optional description, priority and status. Use this when the user wants to add or create a task.",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The title of the task"
                    },
                    description: {
                        type: "string",
                        description: "Optional description for the task"
                    },
                    priority: {
                        type: "string",
                        enum: ["High", "Medium", "Low"],
                        description: "Priority level. Default is Medium."
                    },
                    status: {
                        type: "string",
                        enum: ["Todo", "InProgress", "Done"],
                        description: "Initial status. Default is Todo."
                    }
                },
                required: ["title"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "updateTask",
            description: "Update an existing task's status, priority or description. Use this when user wants to mark a task as done, change its priority, update its description, or move it to InProgress.",
            parameters: {
                type: "object",
                properties: {
                    taskId: {
                        type: "string",
                        description: "The ID of the task to update"
                    },
                    status: {
                        type: "string",
                        enum: ["Todo", "InProgress", "Done"],
                        description: "New status for the task"
                    },
                    priority: {
                        type: "string",
                        enum: ["High", "Medium", "Low"],
                        description: "New priority for the task"
                    },
                    description: {
                        type: "string",
                        description: "New description for the task"
                    }
                },
                required: ["taskId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "deleteTask",
            description: "Delete a task permanently by its ID. Use this when the user wants to remove or delete a task.",
            parameters: {
                type: "object",
                properties: {
                    taskId: {
                        type: "string",
                        description: "The ID of the task to delete"
                    }
                },
                required: ["taskId"]
            }
        }
    }
];


// ── These are the ACTUAL functions that hit your database ──
// OpenAI tells us WHICH one to call — our code actually runs it

async function getTaskStats(userId: string) {
    // Fetches counts grouped by status + priority
    const taskStats = await prisma.task.groupBy({
        by: ["status", "priority"],
        where: { userId },
        _count: { id: true },
    });

    const totalTasks = await prisma.task.count({
        where: { userId },
    });

    // Count done tasks for completion rate calculation
    const doneTasks = taskStats
        .filter(taskStat => taskStat.status === "Done")
        .reduce((totalCount, taskStat) => totalCount + taskStat._count.id, 0);

    const completionRate = totalTasks > 0
        ? Math.round((doneTasks / totalTasks) * 100)
        : 0;
    // 👆 Completion rate = done tasks / total tasks × 100
    // Example: 3 done out of 10 total = 30%

    return {
        totalTasks,
        completionRate,
        byStatus: {
            todo: taskStats.filter(statusGroup => statusGroup.status === "Todo").reduce((totalCount, statusGroup) => totalCount + statusGroup._count.id, 0),
            inProgress: taskStats.filter(statusGroup => statusGroup.status === "InProgress").reduce((totalCount, statusGroup) => totalCount + statusGroup._count.id, 0),
            done: doneTasks,
        },
        byPriority: {
            high: taskStats.filter(priorityGroup => priorityGroup.priority === "High").reduce((totalCount, priorityGroup) => totalCount + priorityGroup._count.id, 0),
            medium: taskStats.filter(priorityGroup => priorityGroup.priority === "Medium").reduce((totalCount, priorityGroup) => totalCount + priorityGroup._count.id, 0),
            low: taskStats.filter(priorityGroup => priorityGroup.priority === "Low").reduce((totalCount, priorityGroup) => totalCount + priorityGroup._count.id, 0),
        }
    };
}

async function getRecentTasks(userId: string, limit: number = 5) {
    // Fetches most recently created tasks
    const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        // 👆 newest first
        take: limit,
        // 👆 only fetch as many as requested
        select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            description: true,
            createdAt: true,
        }
    });

    return { tasks };
}

async function getTasksByStatus(userId: string, status: "Todo" | "InProgress" | "Done") {
    // Fetches all tasks with a specific status
    const tasks = await prisma.task.findMany({
        where: { userId, status },
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
}


async function createTask(userId: string, title: string, description?: string, priority: "High" | "Medium" | "Low" = "Medium", status: "Todo" | "InProgress" | "Done" = "Todo") {
    // Creates a new task in the database
    const newTask = await prisma.task.create({
        data: {
            title,
            description: description ?? "",
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

    return { success: true, task: newTask };
}

async function updateTask(userId: string, taskId: string, status?: "Todo" | "InProgress" | "Done", priority?: "High" | "Medium" | "Low", description?: string) {
    // First check the task belongs to this user
    const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId },
    });

    if (!existingTask) {
        return { success: false, error: "Task not found or access denied" };
    }

    // Build update object — only update fields that were provided
    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
            ...(status !== undefined && { status }),
            ...(priority !== undefined && { priority }),
            ...(description !== undefined && { description }),
        },
        select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            description: true,
        }
    });

    return { success: true, task: updatedTask };
}

async function deleteTask(userId: string, taskId: string) {
    // First check the task belongs to this user
    const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId },
    });

    if (!existingTask) {
        return { success: false, error: "Task not found or access denied" };
    }

    await prisma.task.delete({
        where: { id: taskId },
    });

    return { success: true, message: `Task "${existingTask.title}" has been deleted.` };
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { prompt, history = [] } = await request.json();
        // 👆 prompt = what user just typed
        // history = previous messages in conversation

        if (!prompt?.trim()) {
            return NextResponse.json(
                { success: false, message: "Prompt is required" },
                { status: 400 }
            );
        }

        const userId = session.user.id;

        // ── ROUND 1: Send question + tools list to OpenAI ──────
        // OpenAI reads the tools and decides if it needs to call one
        const firstResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant built into TaskFlow, a task management app.
You have access to the user's real task data through tools.
Always use a tool to get accurate data before answering questions about tasks.
When listing tasks, always include the task ID in your response.
Keep responses clear and under 200 words.`
                },
                ...history,
                { role: "user", content: prompt }
            ],
            tools,
            // 👆 We send the tools list — OpenAI decides which to call
            tool_choice: "auto",
            // 👆 "auto" = OpenAI decides whether to use a tool or not
            // If the question needs data → it calls a tool
            // If it's a general question → it answers directly
        });

        const firstMessage = firstResponse.choices[0].message;
        // 👆 OpenAI's first reply — may contain a tool_calls array

        // ── ROUND 2: Check if OpenAI wants to call a tool ──────
        if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
            // OpenAI has decided to call one or more tools
            const toolCall = firstMessage.tool_calls[0];
            // 👆 Get the first tool call (we handle one at a time)

            if (toolCall.type !== "function") {
                return NextResponse.json(
                    { success: false, message: "Unsupported tool type" },
                    { status: 500 }
                );
            }

            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
            // 👆 Parse the arguments OpenAI wants to pass to our function

            console.log(`🤖 OpenAI wants to call: ${toolName}`, toolArgs);

            // ── ROUND 2a: Run the actual function ───────────────
            let toolResult: object;

            if (toolName === "getTaskStats") {
                toolResult = await getTaskStats(userId);
            } else if (toolName === "getRecentTasks") {
                toolResult = await getRecentTasks(userId, toolArgs.limit);
            } else if (toolName === "getTasksByStatus") {
                toolResult = await getTasksByStatus(userId, toolArgs.status);
            } else if (toolName === "createTask") {
                toolResult = await createTask(userId, toolArgs.title, toolArgs.description, toolArgs.priority, toolArgs.status);
            } else if (toolName === "updateTask") {
                toolResult = await updateTask(userId, toolArgs.taskId, toolArgs.status, toolArgs.priority, toolArgs.description);
            } else if (toolName === "deleteTask") {
                toolResult = await deleteTask(userId, toolArgs.taskId);
            } else {
                toolResult = { error: "Unknown tool" };
            }
            // 👆 We run the function ourselves — OpenAI just told us which one

            // ── ROUND 3: Send tool result back to OpenAI ────────
            // Now OpenAI uses the real data to form its final answer
            const secondResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an AI assistant built into TaskFlow, a task management app.
You have access to the user's real task data through tools.
Always use a tool to get accurate data before answering questions about tasks.
When listing tasks, always include the task ID in your response.
Keep responses clear and under 200 words.`
                    },
                    ...history,
                    { role: "user", content: prompt },
                    firstMessage,
                    // 👆 Include OpenAI's first reply (which had the tool_call)
                    {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult),
                        // 👆 Send the real DB data back as the tool result
                    }
                ],
                tools,
            });

            const finalMessage = secondResponse.choices[0].message.content;
            // 👆 This is the final answer — based on REAL data from your DB

            return NextResponse.json({
                success: true,
                message: finalMessage,
                toolUsed: toolName,
                // 👆 Useful for debugging — shows which tool was called
            });

        } else {
            // OpenAI answered directly without needing a tool
            // (e.g. general questions like "what is a task?")
            return NextResponse.json({
                success: true,
                message: firstMessage.content,
                toolUsed: null,
            });
        }

    } catch (error: any) {
        console.error("Agent chat error:", error);

        if (error?.status === 429) {
            return NextResponse.json(
                { success: false, message: "Rate limit reached. Please try again." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to process request" },
            { status: 500 }
        );
    }
}
