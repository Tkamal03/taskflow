import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function extractSearchKeywords(userPrompt: string): Promise<string> {
    // ⭐ Dynamically extracts search keywords based on
    // what the user is ACTUALLY asking about
    // No hardcoded bias — adapts to each question

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You help search a task management database.
Extract 4-6 search keywords from the user's question.
Focus on what kind of tasks they want to find.

Rules:
- If asking about urgent/important → include "high priority urgent"
- If asking about completed work → include "done completed"  
- If asking about pending work → include "todo inprogress"
- If asking about specific topic (bugs, features) → include that topic
- If asking general count/overview → include "all tasks overview"

Return ONLY the keywords, no explanation, no punctuation.

Examples:
"What are my urgent tasks?" → "urgent high priority todo critical"
"How many tasks do I have?" → "all tasks total overview count"
"Show me completed work" → "done completed finished tasks"
"Any bugs to fix?" → "bug fix critical error issue high priority"`
            },
            { role: "user", content: userPrompt }
        ],
        max_tokens: 20,
        temperature: 0,
        // 👆 temperature 0 = consistent, predictable keyword extraction
    });

    const keywords = response.choices[0].message.content || userPrompt;
    console.log(`🔍 Query: "${userPrompt}" → Keywords: "${keywords}"`);
    // 👆 Helpful for debugging — shows in VS Code terminal

    return keywords;
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
        // 👆 prompt = what the user just typed
        // history = previous messages in the conversation

        if (!prompt?.trim()) {
            return NextResponse.json(
                { success: false, message: "Prompt is required" },
                { status: 400 }
            );
        }

        // ── STEP 0: Get task statistics for aggregate questions ──
        const taskStats = await prisma.task.groupBy({
            by: ["status", "priority"],
            where: { userId: session.user.id },
            _count: { id: true },
        });

        const totalTasks = await prisma.task.count({
            where: { userId: session.user.id },
        });

        const statsSummary = `
Task Statistics:
- Total tasks: ${totalTasks}
- By Status: ${taskStats.map(s => `${s.status}(${s._count.id})`).join(", ")}
- By Priority: ${["High", "Medium", "Low"].map(p => {
            const count = taskStats.filter(s => s.priority === p)
                .reduce((sum, s) => sum + s._count.id, 0);
            return `${p}(${count})`;
        }).join(", ")}
`.trim();

        // ── STEP 1: Build a focused retrieval query ─────────────
        const searchKeywords = await extractSearchKeywords(prompt);
        const queryEmbedding = await generateEmbedding(searchKeywords);
        const queryVector = `[${queryEmbedding.join(",")}]`;

        // ── STEP 2: Find relevant tasks from DB ────────────────
        const relevantTasks = await prisma.$queryRaw<
            {
                id: string;
                title: string;
                description: string | null;
                priority: string;
                status: string;
                similarity: number;
            }[]
        >`
      SELECT
        id,
        title,
        description,
        priority,
        status,
        1 - (embedding <=> ${queryVector}::vector) AS similarity
      FROM "Task"
      WHERE "userId" = ${session.user.id}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${queryVector}::vector) > 0.2
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT 5
    `;

        // ── STEP 3: Build context from retrieved tasks ─────────
        let taskContext = "";

        if (relevantTasks.length > 0) {
            taskContext = `
Here are the user's relevant tasks from their TaskFlow app:

${relevantTasks.map((task, index) => `
${index + 1}. Title: ${task.title}
   Description: ${task.description || "No description"}
   Priority: ${task.priority}
   Status: ${task.status}
   Relevance: ${Math.round(task.similarity * 100)}%
`).join("")}

Use these tasks to give specific, personalised advice.
Reference task titles directly in your response.
      `.trim();
        }

        // ── STEP 4: Call OpenAI with context + question ────────
        const systemPrompt = `You are an AI assistant built into TaskFlow, a task management app.

${statsSummary}

${taskContext ? `\nRelevant tasks for this query:\n${taskContext}` : ""}

Guidelines:
- Use the Task Statistics above for any count or aggregate questions
- Use the Relevant tasks for specific task details and advice
- Reference specific task titles when giving recommendations
- Keep responses under 200 words
- Never make up tasks not shown above
- Note: Only up to 5 most relevant tasks are shown here. For trend analysis or calculations across all tasks, rely on the Task Statistics above`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                ...history,
                { role: "user", content: prompt },
            ],
            max_tokens: 300,
            temperature: 0.5,
        }, {
            timeout: 15000,
        });

        const message = response.choices[0].message.content;

        if (!message) {
            return NextResponse.json(
                { success: false, message: "No response from AI" },
                { status: 500 }
            );
        }

        // ── STEP 5: Calculate highest similarity score ─────────
        const highestSimilarity = relevantTasks.length > 0
            ? Math.round(Math.max(...relevantTasks.map(t => t.similarity)) * 100)
            : 0;
        // 👆 Find the BEST match score from all returned tasks
        // Math.max(...array) = picks the biggest number
        // * 100 = convert 0.87 → 87 (show as percentage)

        return NextResponse.json({
            success: true,
            message,
            relevantTasksFound: relevantTasks.length,

            // ── RAG Info Badge data ─────────────────────────────
            ragType: "Naive RAG",
            // 👆 This route always uses Naive RAG
            chunkType: "Document Specific Chunking",
            // 👆 One task = one chunk (buildTaskText in lib/embeddings.ts)
            highestSimilarity,
            // 👆 Best similarity score as percentage (e.g. 87)
        });

    } catch (error: any) {
        console.error("RAG chat error:", error);

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
