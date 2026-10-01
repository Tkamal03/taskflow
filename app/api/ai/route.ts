import { NextResponse } from "next/server";
// 👆 NextResponse — Next.js helper for creating API responses
// Same pattern used in all our TaskFlow API routes

import OpenAI from "openai";
// 👆 Official OpenAI SDK we installed via npm install openai
// Handles all HTTP request details for us — no manual fetch needed

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // 👆 Reading the API key from .env.local — NEVER hardcode this!
  // Same pattern as process.env.DATABASE_URL in our Prisma setup
  // process.env reads from environment variables at RUNTIME
});
// 👆 Creating ONE instance of the OpenAI client outside the handler
// This is the same "singleton" pattern we used for Prisma in lib/prisma.ts
// Avoids creating a new client on EVERY request — better performance

const systemPrompt = `You are an AI assistant built into TaskFlow, a personal task management app. 
TaskFlow allows users to create tasks with a title, description, priority (Low, Medium, High), and status (Todo, InProgress, Done).

Your role is to:
- Help users prioritize and organize their tasks effectively
- Suggest strategies for productivity and task management
- Help users write clearer, more actionable task descriptions
- Give advice on managing workload and deadlines

Rules you must follow:
- Keep ALL responses under 150 words — be concise and actionable
- Always give practical, specific advice (not vague motivational phrases)
- If asked about something completely unrelated to tasks or productivity, 
  politely redirect: "I'm here to help with task management. Try asking me about prioritizing your tasks!"
- Never make up information about the user's actual tasks (you can't see them)
- Use simple, friendly language — no jargon`;
// ⭐ UPDATED — moved systemPrompt to a constant OUTSIDE the handler
// Previously it was inline inside the messages array
// Now extracted as a named constant for two reasons:
// 1. Cleaner, more readable code
// 2. Easier to update in one place without touching the handler logic

export async function POST(request: Request) {
  // 👆 POST handler — called when frontend sends a POST request to /api/ai
  // Only POST is exported — GET/PUT/DELETE would be ignored here

  try {
    const { prompt, history = [] } = await request.json();
    // ⭐ NEW — destructuring BOTH prompt AND history from request body
    // prompt = the current user message (string)
    // history = the previous conversation messages (array, defaults to [])
    // Default value [] means this works even if history isn't sent
    // (backward compatible with our original single-message approach)

    if (!prompt) {
      return NextResponse.json(
        { success: false, message: "Prompt is required" },
        { status: 400 }
        // 👆 400 = "Bad Request" — client sent incomplete data
        // We return early here before even calling OpenAI
        // Saves tokens (and money!) by not making unnecessary API calls
      );
    }

    const response = await openai.chat.completions.create({
      // 👆 openai.chat.completions.create — the main SDK method
      // "chat" = using the chat-based API (conversation model)
      // "completions" = generating a completion (response) to our messages
      // "create" = creating a new completion request

      model: "gpt-4o-mini",
      // 👆 Using gpt-4o-mini — the most cost-efficient model on our tier
      // "mini" = smaller, faster, cheaper than full gpt-4o
      // Perfect for our task management assistant use case

      messages: [
        {
          role: "system",
          content: systemPrompt
          // 👆 System prompt goes FIRST in the messages array
          // Sets the AI's role and rules for the ENTIRE conversation
          // This is what we learned on Day 1 — system prompts define behavior
        },
        // ⭐ NEW — spread the conversation history BETWEEN system prompt
        // and the new user message
        ...history,
        // 👆 Each item in history is already { role: "user"|"assistant", content: "..." }
        // which matches exactly what OpenAI's messages array expects!
        // The spread operator (...) inserts all history messages here
        // So the full array looks like:
        // [system, user_msg_1, assistant_reply_1, user_msg_2, assistant_reply_2, new_user_msg]
        {
          role: "user",
          content: prompt
          // 👆 The NEW user message goes LAST — most recent message at the end
          // This is the current question the user just asked
        }
      ],

      max_tokens: 500,
      // 👆 Limits how long the AI's response can be
      // 500 tokens ≈ roughly 375 words
      // Prevents unexpectedly long (and expensive) responses

      temperature: 0.7,
      // 👆 Slightly creative but still focused
      // 0 = fully deterministic, 1+ = very creative/random
      // 0.7 is a common sweet spot for assistant-style responses

    }, {
      timeout: 10000,
      // ⭐ NEW — 10 second timeout (10,000 milliseconds)
      // Added from our Q6 discussion yesterday — without this,
      // if OpenAI's servers are slow or down, the user would stare
      // at "Thinking..." for 30-60 seconds before seeing any error.
      // Now after 10 seconds, the SDK throws an error which our
      // catch block handles gracefully
    });

    const aiMessage = response.choices[0].message.content;
    // 👆 Extracting just the AI's reply text from the full response object
    // response.choices — array of possible completions (usually just 1)
    // [0] — first (and only) choice
    // .message.content — the actual text string the AI generated
    // This is the same path we learned conceptually on Day 1!

    return NextResponse.json({
      success: true,
      message: aiMessage,
      // 👆 Sending back the AI's reply text to the frontend
      usage: response.usage
      // 👆 Also sending back token usage data — useful for:
      // 1. Debugging how many tokens each request consumes
      // 2. Monitoring costs in production
      // 3. Understanding the real-world impact of prompt length
    });

  } catch (error: any) {
    // 👆 error: any — needed because OpenAI SDK errors have custom properties
    // (like error.status) that TypeScript doesn't know about by default
    console.error("AI API error:", error);
    // 👆 Always log the full error server-side for debugging
    // This appears in your terminal (local) or Vercel logs (production)

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, message: "Rate limit reached. Please try again shortly." },
        { status: 429 }
        // 👆 429 = "Too Many Requests"
        // On our free/tier-1 plan, this means we've hit OpenAI's rate limit
        // OR exhausted our credit balance entirely
        // We give users a specific, actionable message instead of generic error
      );
    }

    if (error?.status === 401) {
      return NextResponse.json(
        { success: false, message: "Invalid API key. Check your .env.local file." },
        { status: 401 }
        // 👆 401 = "Unauthorized"
        // Means our OPENAI_API_KEY is wrong, missing, or revoked
        // The message specifically tells the DEVELOPER where to look
        // (not ideal to show this to real end users in production —
        //  we'd use a more generic message there)
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to get AI response" },
      { status: 500 }
      // 👆 500 = generic server error fallback
      // Catches everything else — network issues, unexpected errors,
      // OpenAI server being completely down, timeout expiry, etc.
    );
  }
}
