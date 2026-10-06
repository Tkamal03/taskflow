"use client";

import { useState, useRef } from "react";
import { Message } from "./AiMessageList";
// 👆 Import Message type from AiMessageList — single source of truth

export function useAiChat(initialMessages: Message[] = []) {
    // ⭐ Custom hook — ALL shared AI chat logic lives here
    // Both dashboard panel AND ai-chat page use this hook
    // No more duplicate state and handler code!

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // 👆 Scroll ref also centralised here — passed down to AiMessageList

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
            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: content,
                    history: messages,
                    // 👆 Always sends full history — works for both pages
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
    };
}
