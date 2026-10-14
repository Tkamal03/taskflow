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
        // = [] means if no history sent, default to empty array

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
        // 👆 groupBy — groups tasks by status AND priority
        // Returns counts for each combination
        // Example result:
        // [
        //   { status: "Todo", priority: "High", _count: { id: 2 } }
        //   { status: "Done", priority: "Low",  _count: { id: 3 } }
        // ]

        const totalTasks = await prisma.task.count({
            where: { userId: session.user.id },
        });
        // 👆 Simple total count of ALL user's tasks
        // This is what we use for "how many tasks?" questions

        // Build a stats summary string
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
        // 👆 Builds a readable summary like:
        // "Total tasks: 10
        //  By Status: Todo(5), InProgress(2), Done(3)
        //  By Priority: High(3), Medium(5), Low(2)"

        // ── STEP 1: Build a focused retrieval query ─────────────
        const searchKeywords = await extractSearchKeywords(prompt);
        // 👆 Dynamically extract what the user is actually asking about
        // Different questions → different search keywords
        const queryEmbedding = await generateEmbedding(searchKeywords);
        // 👆 We search using KEY CONCEPTS, not the full question
        // But we answer using the full original prompt
        const queryVector = `[${queryEmbedding.join(",")}]`;
        // 👆 Convert user's question to a vector
        // Same as semantic search — we need this to find
        // which tasks are RELEVANT to the question

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
        // 👆 Same as semantic search PLUS one new line:
        //
        // AND 1 - (embedding <=> ...) > 0.2
        // ────────────────────────────────────
        // This is a SIMILARITY THRESHOLD
        // Only include tasks with similarity > 20%
        // Why? Because we don't want to send irrelevant tasks
        // to the AI as "context" — that would confuse it!
        //
        // Example:
        // User asks: "what are my bugs?"
        // "Fix login bug" similarity = 0.89 ✅ included
        // "Buy groceries" similarity = 0.12 ❌ excluded
        // Without threshold, "Buy groceries" would be sent
        // to AI as "relevant context" — which is wrong!

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
            // 👆 We format the tasks as readable text for the AI
            // The AI reads this as CONTEXT before answering
            // Like giving someone a list of facts before asking
            // them a question — they'll give a better answer!
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
        // 👆 The system prompt now has TWO parts:
        // 1. The retrieved task context (STEP 3)
        // 2. Instructions for how to use that context
        //
        // This is the "Augmented" part of RAG:
        // Retrieval → Augmented → Generation
        // We AUGMENT the prompt with retrieved data!

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                // 👆 System prompt includes the retrieved task context
                ...history,
                // 👆 Previous conversation messages
                { role: "user", content: prompt },
                // 👆 Current user question
            ],
            max_tokens: 300,
            temperature: 0.5,
            // 👆 Slightly lower temperature than general chat (0.7)
            // We want factual answers about REAL tasks
            // not creative interpretations!
        }, {
            timeout: 15000,
            // 👆 Slightly longer timeout — RAG does more work
            // (embedding + DB search + generation)
        });

        const message = response.choices[0].message.content;

        if (!message) {
            return NextResponse.json(
                { success: false, message: "No response from AI" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message,
            // 👆 The AI's response — references YOUR actual tasks!
            relevantTasksFound: relevantTasks.length,
            // 👆 How many tasks were used as context
            // Useful for debugging during development
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
