import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateText, tool, isStepCount } from "ai";
import { openai } from "@ai-sdk/openai";
import { createMCPClient } from "@ai-sdk/mcp";
import { z } from "zod";

import {
    getTaskStats,
    getRecentTasks,
    getAllTasks,
    getTasksByStatus,
    createTask,
    updateTask,
    deleteTask,
} from "@/lib/taskService";

// ── System prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant built into TaskFlow, a task management app.
You have access to the user's real task data through tools.
You also have location and weather tools connected via a remote MCP server.
Always use a tool to get accurate data before answering questions about tasks or weather.
When listing tasks, always include the task ID in your response.
If the user asks about weather without specifying a location, FIRST call get_location to get their coordinates, THEN call get_weather with those coordinates.
Keep responses clear and under 200 words.`;


export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "Not authenticated" },
            { status: 401 }
        );
    }

    const { prompt, history = [] } = await request.json();

    if (!prompt?.trim()) {
        return NextResponse.json(
            { success: false, message: "Prompt is required" },
            { status: 400 }
        );
    }

    const userId = session.user.id;

    // ── Connect to Remote MCP Server ──────────────────────────────────
    // createMCPClient replaces the old callRemoteMcpTool + parseMcpResponse helpers
    // It handles: initialize handshake, JSON/SSE parsing, session management
    // client.tools() auto-discovers get_location + get_weather from your Render server
    const mcpClient = await createMCPClient({
        transport: {
            type: "http",
            url: process.env.REMOTE_MCP_URL!,
        },
    });

    try {
        // Auto-discover all tools from your Remote MCP Server
        // Returns: { get_location: Tool, get_weather: Tool }
        // Tool descriptions come from the server — no duplication needed here
        const mcpTools = await mcpClient.tools();

        // ── Local DB tools (Vercel AI SDK v7 format) ─────────────────
        // Note: v7 uses "inputSchema" instead of "parameters"
        // execute function lives INSIDE each tool — no separate switch case needed
        const dbTools = {

            getTaskStats: tool({
                description: "Get total task counts grouped by status (Todo, InProgress, Done) and priority (High, Medium, Low). Use for questions about counts, completion rate, or progress overview.",
                inputSchema: z.object({}),
                execute: async () => await getTaskStats(userId),
            }),

            getRecentTasks: tool({
                description: "Get the most recently created tasks with title, status, priority and description. Use for questions about recent work or latest tasks.",
                inputSchema: z.object({
                    limit: z.number().optional().describe("How many recent tasks to fetch. Default is 5."),
                }),
                execute: async ({ limit }) => await getRecentTasks(userId, limit),
            }),

            getAllTasks: tool({
                description: "Get ALL tasks with complete details. Use for any analytical question: trends, patterns, overdue tasks, productivity calculations.",
                inputSchema: z.object({}),
                execute: async () => await getAllTasks(userId),
            }),

            getTasksByStatus: tool({
                description: "Get all tasks filtered by a specific status.",
                inputSchema: z.object({
                    status: z.enum(["Todo", "InProgress", "Done"]),
                }),
                execute: async ({ status }) => await getTasksByStatus(userId, status),
            }),

            createTask: tool({
                description: "Create a new task. Use when the user wants to add a task.",
                inputSchema: z.object({
                    title: z.string().describe("Title of the task"),
                    description: z.string().optional().describe("Optional description"),
                    priority: z.enum(["High", "Medium", "Low"]).optional(),
                    status: z.enum(["Todo", "InProgress", "Done"]).optional(),
                }),
                execute: async ({ title, description, priority, status }) =>
                    await createTask(userId, title, description, priority, status),
            }),

            updateTask: tool({
                description: "Update an existing task's status, priority or description.",
                inputSchema: z.object({
                    taskId: z.string().describe("The ID of the task to update"),
                    status: z.enum(["Todo", "InProgress", "Done"]).optional(),
                    priority: z.enum(["High", "Medium", "Low"]).optional(),
                    description: z.string().optional(),
                }),
                execute: async ({ taskId, status, priority, description }) =>
                    await updateTask(userId, taskId, status, priority, description),
            }),

            deleteTask: tool({
                description: "Delete a task permanently by its ID.",
                inputSchema: z.object({
                    taskId: z.string().describe("The ID of the task to delete"),
                }),
                execute: async ({ taskId }) => await deleteTask(userId, taskId),
            }),
        };

        // ── Run the AI Agent (ReAct loop) ─────────────────────────────
        // generateText + stopWhen replaces your old manual for loop (50+ lines)
        // SDK handles automatically: Thought → Action → Observe → repeat
        const { text, steps } = await generateText({
            model: openai("gpt-4o-mini"),
            system: SYSTEM_PROMPT,
            stopWhen: isStepCount(5),
            // 👆 Replaces: for (let loopRound = 0; loopRound < MAX_ROUNDS; loopRound++)
            tools: {
                ...dbTools,   // getTaskStats, createTask, etc. → Prisma DB
                ...mcpTools,  // get_location, get_weather → Remote MCP Server (Render)
            },
            messages: [
                ...history,
                { role: "user", content: prompt },
            ],
        });

        // ── Extract which tools were called (from steps array) ────────
        // steps = array of each ReAct cycle: [{ toolCalls, toolResults }, ...]
        const toolsUsed = steps
            .flatMap(step => step.toolCalls ?? [])
            .map(tc => tc.toolName)
            .join(", ");

        return NextResponse.json({
            success: true,
            message: text,
            toolUsed: toolsUsed || null,
        });

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

    } finally {
        // Always close MCP client — releases the connection to Render server
        await mcpClient.close();
    }
}
