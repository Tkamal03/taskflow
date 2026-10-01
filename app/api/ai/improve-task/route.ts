import { NextResponse } from "next/server";
// 👆 NextResponse — Next.js helper for creating API responses

import OpenAI from "openai";
// 👆 Official OpenAI SDK — same one used in our main AI route

import { auth } from "@/auth";
// 👆 Auth check — same security pattern used across ALL our API routes
// We always verify the user is logged in before doing anything

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // 👆 Reading API key from environment variables — never hardcoded
});
// 👆 Singleton OpenAI client — created once, reused across requests

export async function POST(request: Request) {
  // 👆 POST handler — called when frontend sends task data to improve

  try {
    const session = await auth();
    // 👆 Verify user is authenticated first — same 3-layer security
    // pattern we built in Week 2

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
        // 👆 401 = Unauthorized — user must be logged in
      );
    }

    const { title, description } = await request.json();
    // 👆 Destructuring the task data from request body
    // title = the task's current title (context for AI)
    // description = the current description to improve

    if (!title) {
      return NextResponse.json(
        { success: false, message: "Task title is required" },
        { status: 400 }
        // 👆 400 = Bad Request — we need at least a title to work with
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      // 👆 Same cost-efficient model as our main AI route

      messages: [
        {
          role: "system",
          content: `You are a task description writer for TaskFlow, a task management app.
Your job is to rewrite task descriptions to be clearer, more specific, and actionable.

Rules:
- Keep descriptions under 100 words
- Use active voice ("Fix the login bug" not "The login bug should be fixed")
- Include WHAT needs to be done and WHY if possible
- Be specific — avoid vague terms like "handle", "deal with", "look into"
- Output ONLY the improved description text — no explanations, 
  no "Here is the improved version:", just the description itself`
          // 👆 This system prompt is DIFFERENT from our main AI assistant
          // It's specifically designed for ONE job: rewriting task descriptions
          // Notice "Output ONLY the improved description text" — 
          // this constrains the AI to give us JUST what we need,
          // no extra commentary that we'd have to strip out in code
        },
        {
          role: "user",
          content: `Task title: "${title}"
Current description: "${description || "No description provided"}"

Please write an improved description for this task.`
          // 👆 Providing BOTH title AND description gives the AI
          // full context — the title tells it WHAT the task is about,
          // the description tells it what we're starting with
          // If no description exists, we still give the AI the title
          // so it can generate a description from scratch
        }
      ],

      max_tokens: 150,
      // 👆 Stricter token limit than our main AI route (150 vs 500)
      // Because task descriptions should be SHORT — we don't want
      // the AI writing an essay, just a concise improved description
      // Also keeps cost per improvement very low

      temperature: 0.4,
      // 👆 Lower temperature than our main route (0.4 vs 0.7)
      // Task descriptions need to be PRECISE and CONSISTENT
      // not creative or random — lower temp = more focused output

    }, {
      timeout: 10000,
      // 👆 Same 10 second timeout as our main AI route
      // Prevents hanging if OpenAI is slow/down
    });

    const improvedDescription = response.choices[0].message.content?.trim();
    // 👆 .trim() removes any leading/trailing whitespace
    // the AI sometimes adds a newline at the start/end

    return NextResponse.json({
      success: true,
      improvedDescription,
      // 👆 Sending back JUST the improved text
      // Frontend will show this to the user to accept or dismiss
      usage: response.usage
      // 👆 Token usage for monitoring/debugging
    });

  } catch (error: any) {
    console.error("Improve task AI error:", error);
    // 👆 Always log server-side for debugging

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, message: "Rate limit reached. Please try again shortly." },
        { status: 429 }
      );
    }

    if (error?.status === 401) {
      return NextResponse.json(
        { success: false, message: "Invalid API key." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to improve task description" },
      { status: 500 }
    );
  }
}
