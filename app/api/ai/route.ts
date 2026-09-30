import { NextResponse } from "next/server";
import OpenAI from "openai";
// 👆 Importing the official OpenAI SDK we just installed

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // 👆 Reading the API key from .env.local — NEVER hardcode this!
    // Same pattern as process.env.DATABASE_URL in our Prisma setup
});
// 👆 Creating ONE instance of the OpenAI client
// This is the same "singleton" pattern we used for Prisma in lib/prisma.ts

export async function POST(request: Request) {
    try {
        const { prompt } = await request.json();
        // 👆 Reading the prompt from the request body
        // Frontend will send: { prompt: "user's question here" }

        if (!prompt) {
            return NextResponse.json(
                { success: false, message: "Prompt is required" },
                { status: 400 }
            );
        }
        const system_prompt = `You are an AI assistant built into TaskFlow, a personal task management app. 
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

        const response = await openai.chat.completions.create({
            // 👆 openai.chat.completions.create — the main method for 
            // sending a message and getting a response back
            // "chat" because we're using the chat-based API (not the older completion API)

            model: "gpt-4o-mini",
            // 👆 Using gpt-4o-mini — the most cost-efficient model available
            // on the free tier. "mini" = smaller, faster, cheaper than full gpt-4o
            // Perfect for learning and experimentation

            messages: [
                {
                    role: "system",
                    content: system_prompt
                    // 👆 This is our SYSTEM PROMPT — sets the AI's role and personality
                    // for the ENTIRE conversation session
                    // Notice how this directly connects to what we learned in Day 1!
                },
                {
                    role: "user",
                    content: prompt
                    // 👆 This is the USER PROMPT — the actual question from the user
                    // Changes with every request
                }
            ],

            max_tokens: 500,
            // 👆 Limits how long the AI's response can be
            // 500 tokens ≈ roughly 375 words — enough for a helpful answer
            // without burning through our free tier credits too quickly

            temperature: 0.7,
            // 👆 Slightly creative but still focused
            // 0.7 is a common sweet spot for assistant-style responses
        });

        const aiMessage = response.choices[0].message.content;
        // 👆 Remember from Day 1? The actual AI text lives at:
        // response.choices[0].message.content
        // We're extracting just that text from the full response object

        return NextResponse.json({
            success: true,
            message: aiMessage,
            // 👆 Sending back the AI's reply
            usage: response.usage
            // 👆 Also sending back token usage info — useful for debugging
            // and understanding how many tokens each request actually uses
        });

    } catch (error: any) {
        console.error("AI API error:", error);

        // 👆 OpenAI has specific error types worth handling separately
        if (error?.status === 429) {
            return NextResponse.json(
                { success: false, message: "Rate limit reached. Please try again shortly." },
                { status: 429 }
            );
            // 👆 429 = "Too Many Requests" — means we've hit OpenAI's rate limit
            // Very common on the free tier (limited requests per minute)
        }

        if (error?.status === 401) {
            return NextResponse.json(
                { success: false, message: "Invalid API key. Check your .env.local file." },
                { status: 401 }
            );
            // 👆 401 = "Unauthorized" — means our API key is wrong or missing
        }

        return NextResponse.json(
            { success: false, message: "Failed to get AI response" },
            { status: 500 }
        );
    }
}
