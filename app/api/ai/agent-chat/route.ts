import { NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

// ⭐ Import all DB task functions from the shared service layer
import {
    getTaskStats,
    getRecentTasks,
    getAllTasks,
    getTasksByStatus,
    createTask,
    updateTask,
    deleteTask,
} from "@/lib/taskService";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ── Remote MCP Server URL ─────────────────────────────────────────────
const REMOTE_MCP_URL = process.env.REMOTE_MCP_URL || "http://localhost:3001/mcp";


// ─────────────────────────────────────────────────────────────────────
// HELPER: parseMcpResponse
// ─────────────────────────────────────────────────────────────────────
// The MCP Streamable HTTP transport can respond in TWO formats:
//
//   1. Plain JSON  → Content-Type: application/json
//      Body:  { "jsonrpc": "2.0", "id": 1, "result": { ... } }
//
//   2. SSE stream  → Content-Type: text/event-stream
//      Body:  "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{...}}\n\n"
//
// This helper reads the raw text and parses whichever format the server chose.
// ─────────────────────────────────────────────────────────────────────
async function parseMcpResponse(response: Response): Promise<{
    jsonrpc: string;
    id: number;
    result?: { content: Array<{ type: string; text: string }> };
    error?: { code: number; message: string };
}> {
    const contentType = response.headers.get("content-type") ?? "";
    const rawText = await response.text();
    // 👆 Always read as raw text first — we'll parse based on content type

    if (contentType.includes("text/event-stream")) {
        // ── SSE format: extract the JSON from the "data:" line ───────
        // SSE looks like:
        //   event: message
        //   data: {"jsonrpc":"2.0","id":1,"result":{...}}
        //
        // We scan each line for one that starts with "data:" and parse it
        const sseLines = rawText.split("\n");
        for (const sseLine of sseLines) {
            if (sseLine.startsWith("data:")) {
                const jsonPayload = sseLine.slice("data:".length).trim();
                // 👆 Remove the "data:" prefix and any surrounding whitespace
                if (jsonPayload) {
                    return JSON.parse(jsonPayload);
                    // 👆 Parse and return the actual JSON-RPC object
                }
            }
        }
        throw new Error(`MCP SSE response had no data line. Raw: ${rawText.slice(0, 200)}`);

    } else {
        // ── Plain JSON format: parse directly ────────────────────────
        return JSON.parse(rawText);
    }
}


// ─────────────────────────────────────────────────────────────────────
// HELPER: callRemoteMcpTool
// ─────────────────────────────────────────────────────────────────────
// Sends initialize → tools/call to the remote MCP server.
// Handles both JSON and SSE responses via parseMcpResponse.
// ─────────────────────────────────────────────────────────────────────
async function callRemoteMcpTool(
    toolName: string,
    toolArguments: Record<string, unknown> = {}
): Promise<string> {

    // ── STEP 1: Initialize the MCP session ───────────────────────────
    const initResponse = await fetch(REMOTE_MCP_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 0,
            method: "initialize",
            params: {
                protocolVersion: "2025-03-26",
                clientInfo: { name: "taskflow-agent", version: "1.0.0" },
                capabilities: {},
            },
        }),
    });

    if (!initResponse.ok) {
        const initErrorBody = await initResponse.text().catch(() => "(no body)");
        throw new Error(`MCP initialize failed HTTP ${initResponse.status}: ${initErrorBody}`);
    }

    const sessionId = initResponse.headers.get("Mcp-Session-Id");
    // 👆 null in stateless mode — included if server is stateful

    // ── STEP 2: Call the actual tool ─────────────────────────────────
    const toolCallHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    };
    if (sessionId) {
        toolCallHeaders["Mcp-Session-Id"] = sessionId;
    }

    const toolResponse = await fetch(REMOTE_MCP_URL, {
        method: "POST",
        headers: toolCallHeaders,
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: toolName, arguments: toolArguments },
        }),
    });

    if (!toolResponse.ok) {
        const toolErrorBody = await toolResponse.text().catch(() => "(no body)");
        throw new Error(`Remote MCP server HTTP ${toolResponse.status} for "${toolName}": ${toolErrorBody}`);
    }

    const toolJsonResponse = await parseMcpResponse(toolResponse);

    if (toolJsonResponse.error) {
        throw new Error(`MCP tool "${toolName}" error (code ${toolJsonResponse.error.code}): ${toolJsonResponse.error.message}`);
    }

    return toolJsonResponse.result?.content?.[0]?.text ?? "";
}


// ─────────────────────────────────────────────────────────────────────
// HELPER: executeTool
// ─────────────────────────────────────────────────────────────────────
// Centralized tool executor — called in every round of the agentic loop.
// Takes a tool name + args, runs it (DB or Remote MCP), returns the result.
//
// WHY EXTRACTED?
// We used to duplicate this logic in ROUND 2 and ROUND 3.
// Now we call executeTool() in both rounds — no duplication.
// ─────────────────────────────────────────────────────────────────────
async function executeTool(
    toolName: string,
    toolArgs: Record<string, unknown>,
    userId: string
): Promise<object> {

    if (toolName === "getTaskStats") {
        return await getTaskStats(userId);

    } else if (toolName === "getRecentTasks") {
        return await getRecentTasks(userId, toolArgs.limit as number);

    } else if (toolName === "getAllTasks") {
        return await getAllTasks(userId);

    } else if (toolName === "getTasksByStatus") {
        return await getTasksByStatus(userId, toolArgs.status as any);

    } else if (toolName === "createTask") {
        return await createTask(
            userId,
            toolArgs.title as string,
            toolArgs.description as string,
            toolArgs.priority as any,
            toolArgs.status as any
        );

    } else if (toolName === "updateTask") {
        return await updateTask(
            userId,
            toolArgs.taskId as string,
            toolArgs.status as any,
            toolArgs.priority as any,
            toolArgs.description as string
        );
    } else if (toolName === "deleteTask") {
        return await deleteTask(userId, toolArgs.taskId as string);

    } else if (toolName === "get_location") {
        // ⭐ Remote MCP tool
        console.log("📍 Calling remote MCP: get_location");
        try {
            const locationText = await callRemoteMcpTool("get_location", {});
            return { location: JSON.parse(locationText) };
        } catch (mcpError) {
            console.error("get_location MCP error:", mcpError);
            return { error: "Could not get location. MCP server may be offline." };
        }

    } else if (toolName === "get_weather") {
        // ⭐ Remote MCP tool
        console.log("🌤️ Calling remote MCP: get_weather", toolArgs);
        try {
            const weatherText = await callRemoteMcpTool("get_weather", {
                latitude: toolArgs.latitude,
                longitude: toolArgs.longitude,
                city: toolArgs.city,
            });
            return { weather: JSON.parse(weatherText) };
        } catch (mcpError) {
            console.error("get_weather MCP error:", mcpError);
            return { error: "Could not get weather. MCP server may be offline." };
        }

    } else {
        return { error: `Unknown tool: ${toolName}` };
    }
}


// ── Tool definitions — all 9 tools OpenAI knows about ────────────────
const tools: OpenAI.Chat.ChatCompletionTool[] = [

    // ── Task tools (DB via taskService) ──────────────────────────────
    {
        type: "function",
        function: {
            name: "getTaskStats",
            description: "Get total task counts grouped by status (Todo, InProgress, Done) and priority (High, Medium, Low). Use this for questions about counts, completion rate, progress overview, or how many tasks exist.",
            parameters: { type: "object", properties: {}, required: [] }
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
                    limit: { type: "number", description: "How many recent tasks to fetch. Default is 5." }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getAllTasks",
            description: "Get ALL tasks with complete details — title, description, status, priority, createdAt, updatedAt. Use this for ANY analytical question: trends, patterns, which day, which priority, overdue tasks, productivity calculations, or any question that needs full task data to reason over.",
            parameters: { type: "object", properties: {}, required: [] }
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
                    status: { type: "string", enum: ["Todo", "InProgress", "Done"], description: "The status to filter by" }
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
                    title: { type: "string", description: "The title of the task" },
                    description: { type: "string", description: "Optional description for the task" },
                    priority: { type: "string", enum: ["High", "Medium", "Low"], description: "Priority level. Default is Medium." },
                    status: { type: "string", enum: ["Todo", "InProgress", "Done"], description: "Initial status. Default is Todo." }
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
                    taskId: { type: "string", description: "The ID of the task to update" },
                    status: { type: "string", enum: ["Todo", "InProgress", "Done"], description: "New status for the task" },
                    priority: { type: "string", enum: ["High", "Medium", "Low"], description: "New priority for the task" },
                    description: { type: "string", description: "New description for the task" }
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
                    taskId: { type: "string", description: "The ID of the task to delete" }
                },
                required: ["taskId"]
            }
        }
    },

    // ── Remote MCP tools (HTTP via callRemoteMcpTool) ─────────────────
    {
        type: "function",
        function: {
            name: "get_location",
            description: "Get the user's current location — city, country, latitude, longitude, and timezone. Use this when the user asks where they are, or BEFORE calling get_weather when no specific location is mentioned.",
            parameters: { type: "object", properties: {}, required: [] }
        }
    },
    {
        type: "function",
        function: {
            name: "get_weather",
            description: "Get the current weather for a location using latitude and longitude. Returns temperature, wind speed, and weather condition. If the user does not specify a location, call get_location first to get coordinates, then call get_weather with those coordinates.",
            parameters: {
                type: "object",
                properties: {
                    latitude: { type: "number", description: "Latitude of the location (e.g. 13.0827 for Chennai)" },
                    longitude: { type: "number", description: "Longitude of the location (e.g. 80.2707 for Chennai)" },
                    city: { type: "string", description: "City name — optional, used only for display in the response" }
                },
                required: ["latitude", "longitude"]
            }
        }
    },
];

// ── System prompt — shared across all OpenAI calls ────────────────────
const SYSTEM_PROMPT = `You are an AI assistant built into TaskFlow, a task management app.
You have access to the user's real task data through tools.
You also have location and weather tools connected via a remote MCP server.
Always use a tool to get accurate data before answering questions about tasks or weather.
When listing tasks, always include the task ID in your response.
If the user asks about weather without specifying a location, FIRST call get_location to get their coordinates, THEN call get_weather with those coordinates.
Keep responses clear and under 200 words.`;


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

        if (!prompt?.trim()) {
            return NextResponse.json(
                { success: false, message: "Prompt is required" },
                { status: 400 }
            );
        }

        const userId = session.user.id;

        // Filter out history messages that cause OpenAI 400 errors:
        // 1. Assistant messages with tool_calls (incomplete tool exchange)
        // 2. Any message where content is null
        const safeHistory = history.filter(
            (message: { role: string; content: string | null; tool_calls?: unknown }) =>
                !(message.role === "assistant" && message.tool_calls) &&
                message.content !== null
        );

        // ── AGENTIC LOOP ──────────────────────────────────────────────
        // WHY A LOOP?
        // Some tasks require chained tool calls. Example: "what's the weather?"
        //   Turn 1: OpenAI calls get_location → we run it → return result
        //   Turn 2: OpenAI calls get_weather  → we run it → return result
        //   Turn 3: OpenAI has all data → writes final answer → no more tool calls
        //
        // Without a loop, we'd stop after Turn 1 and return message: null
        // (OpenAI has no answer yet — it still needs to call get_weather).
        //
        // The loop runs until OpenAI stops asking for tools (max 5 rounds as safety cap).
        // ─────────────────────────────────────────────────────────────

        // Build the message history we'll keep extending each loop turn
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: SYSTEM_PROMPT },
            ...safeHistory,
            { role: "user", content: prompt },
        ];

        const allToolsUsed: string[] = [];
        // 👆 Collects every tool name called — for the toolUsed field in response

        const MAX_ROUNDS = 5;
        // 👆 Safety cap — prevents infinite loops if OpenAI keeps calling tools

        for (let loopRound = 0; loopRound < MAX_ROUNDS; loopRound++) {

            // Ask OpenAI what to do next (tool call or final answer)
            const openAiResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                tools,
                tool_choice: "auto",
            });

            const assistantMessage = openAiResponse.choices[0].message;

            // Always add the assistant's message to history
            // This is required so the next OpenAI call has the full context
            messages.push(assistantMessage);

            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
                // ── No more tool calls — OpenAI has a final answer ────
                // Return it to the client
                return NextResponse.json({
                    success: true,
                    message: assistantMessage.content,
                    toolUsed: allToolsUsed.join(", ") || null,
                });
            }

            // ── OpenAI wants to call tools — execute them all ─────────
            const toolResultMessages: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

            for (const toolCall of assistantMessage.tool_calls) {
                if (toolCall.type !== "function") continue;

                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

                console.log(`🤖 [Round ${loopRound + 1}] OpenAI wants to call: ${toolName}`, toolArgs);
                allToolsUsed.push(toolName);

                // Run the tool (DB or Remote MCP) via the shared executor
                const toolResult = await executeTool(toolName, toolArgs, userId);

                // Add this tool's result to the batch
                toolResultMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult),
                    // 👆 JSON.stringify always produces a string — never null
                });
            }

            // Add all tool results to messages — OpenAI sees them next round
            messages.push(...toolResultMessages);
            // 👆 Next loop iteration will call OpenAI again with these results
            // OpenAI will either call more tools or write the final answer
        }

        // ── Safety cap reached — return whatever we have ──────────────
        // This should rarely/never happen in normal use
        return NextResponse.json({
            success: false,
            message: "Agent loop exceeded maximum rounds. Please try again.",
        });

    } catch (error: any) {
        console.error("Agent chat error:", error);
        console.error("Agent chat error FULL:", JSON.stringify(error, null, 2));

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
