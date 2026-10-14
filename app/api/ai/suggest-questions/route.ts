import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        const body = await request.json().catch(() => ({}));
        const askedQuestions: string[] = body.askedQuestions || [];
        // 👆 Questions already asked in this conversation
        // We'll tell AI to avoid these themes
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        // ── Get real task stats from DB ──────────────────────
        const totalTasks = await prisma.task.count({
            where: { userId: session.user.id },
        });

        const taskStats = await prisma.task.groupBy({
            by: ["status", "priority"],
            where: { userId: session.user.id },
            _count: { id: true },
        });
        // 👆 Same stats we use in rag-chat
        // Groups tasks by status + priority with counts

        const highPriorityTodo = taskStats
            .filter(s => s.priority === "High" && s.status === "Todo")
            .reduce((sum, s) => sum + s._count.id, 0);
        // 👆 Count of High priority + Todo tasks specifically
        // These are the most urgent tasks the user has

        const doneTasks = taskStats
            .filter(s => s.status === "Done")
            .reduce((sum, s) => sum + s._count.id, 0);
        // 👆 Count of completed tasks

        const inProgressTasks = taskStats
            .filter(s => s.status === "InProgress")
            .reduce((sum, s) => sum + s._count.id, 0);
        // 👆 Count of in-progress tasks

        // ── Ask AI to generate relevant question chips ───────
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You generate smart question suggestions for a task management app.
Generate exactly 4 short, specific questions based on the user's task data.

Rules:
- Each question must be under 8 words
- Make them specific to the numbers provided
- Use emojis at the start for visual appeal
- Questions should help user get VALUE from their data
- NEVER suggest questions about topics already asked
- Vary themes: productivity tips, planning, analysis, specific tasks

Return ONLY a JSON array of 4 strings, nothing else.
Example format: ["🐛 Fix your 2 critical bugs?", "📊 Check overall progress?", "⚡ What needs urgent attention?", "✅ Review completed tasks?"]`
                },
                {
                    role: "user",
                    content: `User task data:
- Total tasks: ${totalTasks}
- High priority Todo: ${highPriorityTodo}
- In Progress: ${inProgressTasks}
- Done: ${doneTasks}

${askedQuestions.length > 0 ? `
Already asked (DO NOT repeat these themes):
${askedQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}
` : ""}

Generate 4 DIFFERENT question chips avoiding the themes above.`
                    // 👆 AI now knows what was asked and avoids repeating!
                    // 👆 We give AI the REAL numbers
                    // So chips are personalised to this specific user
                    // Different users → different chips!
                }
            ],
            max_tokens: 150,
            temperature: 0.7,
            // 👆 Slightly creative — chips should feel fresh
            // not the same every time
        });

        const content = response.choices[0].message.content || "[]";
        // 👆 Default to empty array if AI returns nothing

        let suggestions: string[] = [];
        try {
            suggestions = JSON.parse(content);
            // 👆 Parse the JSON array the AI returned
            // We asked for JSON format in the system prompt
        } catch {
            // 👆 If AI returned invalid JSON, use fallback chips
            suggestions = [
                "⚡ What needs urgent attention?",
                "📊 How am I progressing?",
                "✅ Show my completed tasks",
                "🎯 What should I focus on today?",
            ];
        }

        return NextResponse.json({
            success: true,
            suggestions,
            // 👆 Array of 4 question strings
            // Frontend will render these as clickable chips
        });

    } catch (error) {
        console.error("Suggest questions error:", error);
        // ── Fallback chips if anything fails ─────────────────
        return NextResponse.json({
            success: true,
            suggestions: [
                "⚡ What needs urgent attention?",
                "📊 How am I progressing?",
                "✅ Show my completed tasks",
                "🎯 What should I focus on today?",
            ],
            // 👆 Always return SOMETHING — never show empty chips
            // Good UX: graceful degradation
        });
    }
}
