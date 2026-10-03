import { NextResponse } from "next/server";
// 👆 NextResponse — Next.js helper for creating API responses

import OpenAI from "openai";
// 👆 Official OpenAI SDK

import { auth } from "@/auth";
// 👆 Auth check — always verify user is logged in first

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // 👆 API key from environment variables — never hardcoded
});
// 👆 Singleton OpenAI client — created once outside the handler

export async function POST(request: Request) {
    try {
        const session = await auth();
        // 👆 Security check — same pattern used across all TaskFlow routes

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { title, description } = await request.json();
        // 👆 Destructuring task data from request body
        // title = the task title user typed
        // description = optional description user typed

        if (!title) {
            return NextResponse.json(
                { success: false, message: "Task title is required" },
                { status: 400 }
                // 👆 Can't suggest priority without knowing what the task is!
            );
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            // 👆 Cost-efficient model — same as all our other AI routes

            messages: [
                {
                    role: "system",
                    content: `You are a task priority analyzer for TaskFlow, a task management app.
          
Your ONLY job is to analyze a task and respond with a JSON object in this EXACT format:
{
  "priority": "High" | "Medium" | "Low",
  "reason": "One short sentence explaining why"
}

Priority guidelines:
- High: Urgent tasks, blocking other work, has a deadline, affects others, critical bugs
- Medium: Important but not urgent, regular project work, improvements
- Low: Nice to have, minor improvements, no deadline, doesn't block anything

CRITICAL RULES:
- Respond with VALID JSON ONLY — no extra text, no markdown, no code blocks
- Priority must be EXACTLY "High", "Medium", or "Low" (case sensitive)
- Reason must be under 15 words
- Never ask for more information — always make a decision based on what you have`
                    // ⭐ KEY DIFFERENCE from other system prompts:
                    // We're asking for JSON output specifically
                    // AND being very explicit about the exact format
                    // "VALID JSON ONLY" — no extra text means we can safely
                    // JSON.parse() the response without stripping anything first
                },
                {
                    role: "user",
                    content: `Task title: "${title}"
Description: "${description || "No description provided"}"`
                    // 👆 Simple, direct input — no need for complex prompting here
                    // The system prompt already defines exactly what to do
                }
            ],

            max_tokens: 80,
            // 👆 Very small limit — our JSON response is tiny:
            // {"priority": "High", "reason": "Critical bug affecting users"}
            // That's well under 80 tokens — keeping cost extremely low

            temperature: 0.2,
            // ⭐ LOWEST temperature we've used yet (0.2)
            // Priority classification needs to be DETERMINISTIC
            // The same task should get the same priority every time
            // High creativity (high temperature) would give inconsistent results

            response_format: { type: "json_object" },
            // ⭐ NEW CONCEPT — "JSON mode"
            // This tells OpenAI to GUARANTEE valid JSON output
            // The model will NEVER produce invalid JSON when this is set
            // Without this, the model might occasionally add text before/after the JSON
            // which would break our JSON.parse() call!

        }, {
            timeout: 10000,
            // 👆 10 second timeout — same as all our other routes
        });

        const rawContent = response.choices[0].message.content;
        // 👆 Get the raw response text from the AI

        if (!rawContent) {
            return NextResponse.json(
                { success: false, message: "No response from AI" },
                { status: 500 }
            );
        }

        const suggestion = JSON.parse(rawContent);
        // 👆 Parse the JSON string into a JavaScript object
        // Safe to do directly because:
        // 1. We set response_format: { type: "json_object" } above
        // 2. OpenAI guarantees valid JSON when this is set
        // Without JSON mode, we'd need try/catch around this parse!

        const validPriorities = ["High", "Medium", "Low"];
        if (!validPriorities.includes(suggestion.priority)) {
            // 👆 Extra safety check — even with JSON mode, verify the VALUE
            // is exactly what we expect before sending it to the frontend
            // This prevents edge cases where the AI returns "high" (lowercase)
            // or "MEDIUM" (all caps) which wouldn't match our TaskFlow values
            return NextResponse.json(
                { success: false, message: "Invalid priority returned by AI" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            priority: suggestion.priority,
            // 👆 Exactly "High", "Medium", or "Low" — matches our task schema
            reason: suggestion.reason,
            // 👆 Short explanation to show the user WHY this priority was suggested
            usage: response.usage
            // 👆 Token usage for monitoring
        });

    } catch (error: any) {
        console.error("Priority suggestion error:", error);

        if (error?.status === 429) {
            return NextResponse.json(
                { success: false, message: "Rate limit reached. Please try again." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to suggest priority" },
            { status: 500 }
        );
    }
}
