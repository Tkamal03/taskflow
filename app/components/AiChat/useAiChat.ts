"use client";

import { useState, useRef } from "react";
import { Message } from "./AiMessageList";
// 👆 Import Message type from AiMessageList — single source of truth

export type ChatMode = "rag" | "agent";
// 👆 Two modes:
// "rag"   → calls /api/ai/rag-chat   (semantic search, finds similar tasks)
// "agent" → calls /api/ai/agent-chat (function calling, exact DB queries + CRUD)

export function useAiChat(initialMessages: Message[] = [], initialMode: ChatMode = "rag") {
    // ⭐ Custom hook — ALL shared AI chat logic lives here
    // Both dashboard panel AND ai-chat page use this hook

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ChatMode>(initialMode);
    // 👆 Track which mode is active — rag or agent
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Decide which API endpoint to call based on current mode
    const apiEndpoint = mode === "agent"
        ? "/api/ai/agent-chat"
        : "/api/ai/rag-chat";
    // 👆 Agent mode = function calling (stats, CRUD)
    // RAG mode = semantic search (find similar tasks)

    async function sendMessage(textToSend?: string) {
        const content = textToSend || prompt;
        // 👆 Accepts optional text — handles BOTH:
        // - Chip clicks (pass text directly)
        // - Send button (reads from prompt state)

        if (!content.trim() || loading) return;

        const userMessage: Message = { role: "user", content };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setPrompt("");
        setLoading(true);

        try {
            const res = await fetch(apiEndpoint, {
                // 👆 Uses the dynamic endpoint — rag or agent based on mode
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: content,
                    history: messages,
                    // 👆 Always sends full history — works for both modes
                }),
            });

            const data = await res.json();

            setMessages([
                ...updatedMessages,
                {
                    role: "assistant",
                    content: data.success
                        ? data.message
                        : data.message || "Something went wrong. Please try again.",
                },
            ]);
        } catch {
            setMessages([
                ...updatedMessages,
                { role: "assistant", content: "Failed to connect to AI. Please try again." },
            ]);
        } finally {
            setLoading(false);
            // 👆 Scroll handled by useEffect in AiMessageList watching messages+loading
        }
    }

    function clearMessages() {
        setMessages([]);
        setPrompt("");
        // 👆 Also clear sessionStorage if it exists (used by ai-chat page)
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("aiChatHistory");
        }
    }

    return {
        messages,
        setMessages,
        // 👆 setMessages exposed so ai-chat page can restore from sessionStorage
        prompt,
        setPrompt,
        loading,
        scrollContainerRef,
        sendMessage,
        clearMessages,
        mode,
        setMode,
        // 👆 Expose mode + setMode so AiPanel can render the toggle button
    };
}
