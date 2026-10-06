"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function AiChatPage() {
    const { data: session } = useSession();
    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const chatScrollRef = useRef<HTMLDivElement>(null);
    // ⭐ Ref on scroll CONTAINER — same fix as dashboard panel

    // ⭐ Restore conversation from sessionStorage on page load
    useEffect(() => {
        const saved = sessionStorage.getItem("aiChatHistory");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    // 👆 Restore the conversation from dashboard
                }
            } catch { }
            // 👆 Silent catch — if parsing fails just start fresh
        }
    }, []);
    // 👆 Runs once on mount — checks for carried conversation

    // Auto-scroll when messages change
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTo({
                top: chatScrollRef.current.scrollHeight,
                behavior: "smooth"
            });
        }
    }, [messages]);

    async function handleSend(customPrompt?: string) {
        const textToSend = customPrompt || prompt;
        if (!textToSend.trim() || loading) return;

        const userMessage: Message = { role: "user", content: textToSend };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setPrompt("");
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: textToSend, history: messages })
            });

            const data = await res.json();

            if (data.success) {
                setMessages([...updatedMessages, { role: "assistant", content: data.message }]);
            } else {
                setError(data.message || "Something went wrong");
                setMessages(messages);
            }
        } catch {
            setError("Failed to connect to AI. Please try again.");
            setMessages(messages);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-[#EEF4FC] via-[#E3EDFA] to-[#DCE9FA]">

            {/* Header — matches dashboard panel style */}
            {/* Header */}
            <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
                {/* Left side — logo + title */}
                <div className="flex items-center gap-2">
                    <img src="/ai-chat-icon.png" alt="AI" className="w-6 h-6 object-contain" />
                    <div>
                        <h1 className="text-sm font-semibold text-[#1E293B] font-display">AI Task Assistant</h1>
                        <p className="text-xs text-[#64748B]">
                            {session?.user?.name ? `Hello, ${session.user.name}` : "Your personal task advisor"}
                        </p>
                    </div>
                </div>

                {/* Right side — back to dashboard icon */}
                <Link
                    href="/dashboard"
                    className="w-8 h-8 rounded-lg bg-white/40 hover:bg-white/70 flex items-center justify-center transition-colors"
                    aria-label="Back to dashboard"
                    title="Back to dashboard"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4C3D8F" strokeWidth="2" strokeLinecap="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </Link>
            </div>

            {/* Chat messages — scrollable container */}
            <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto px-4 py-6"
            // ⭐ ref on THIS div — scroll stays inside here, page doesn't move
            >
                <div className="max-w-2xl mx-auto flex flex-col gap-4">

                    {/* Empty state */}
                    {messages.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[#4C3D8F] flex items-center justify-center mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M8 6C5.5 6 4 8 4 10.5C4 13 6 15 8.5 15C11 15 13 13 13 10.5"
                                        stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                                    <path d="M16 18C18.5 18 20 16 20 13.5C20 11 18 9 15.5 9C13 9 11 11 11 13.5"
                                        stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-semibold text-[#1E293B] mb-2 font-display">
                                How can I help you today?
                            </h2>
                            <p className="text-sm text-[#64748B] max-w-sm">
                                Ask me anything about managing your tasks, setting priorities, or staying productive.
                            </p>
                            {/* Suggestion chips — auto-SEND on click */}
                            <div className="flex flex-wrap gap-2 mt-6 justify-center">
                                {[
                                    "How do I prioritize tasks?",
                                    "Help me beat procrastination",
                                    "What is the Eisenhower Matrix?",
                                    "Tips for staying focused"
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => handleSend(suggestion)}
                                        // ⭐ Passes suggestion directly to handleSend — auto-sends!
                                        className="text-xs px-3 py-2 bg-white/70 border border-[#DCE7F5] rounded-full text-[#475569] hover:bg-white hover:border-[#4C3D8F] hover:text-[#4C3D8F] transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-[#4C3D8F] text-white rounded-br-sm"
                                    : "bg-white/80 backdrop-blur-sm border border-white/70 text-[#1E293B] rounded-bl-sm"
                                    }`}
                            >
                                {msg.role === "assistant" && (
                                    <p className="text-xs font-medium text-[#4C3D8F] mb-1.5">AI Assistant</p>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {/* Loading dots */}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white/80 backdrop-blur-sm border border-white/70 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                                <p className="text-sm text-[#4C3D8F]">AI is thinking...</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex justify-center">
                            <div className="px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                                <p className="text-xs text-rose-600">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 bg-white/55 backdrop-blur-md border-t border-white/70 px-4 py-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 bg-white border border-[#DCE7F5] rounded-xl px-3.5 focus-within:border-[#4C3D8F] focus-within:ring-1 focus-within:ring-[#4C3D8F] transition-colors">

                        {/* ⭐ Clear icon — LEFT side of input, only shows when messages exist */}
                        {messages.length > 0 && (
                            <button
                                onClick={() => {
                                    setMessages([]);
                                    setPrompt("");
                                    setError("");
                                    sessionStorage.removeItem("aiChatHistory");
                                }}
                                className="flex-shrink-0 text-[#94A3B8] hover:text-rose-400 transition-colors"
                                title="Clear conversation"
                                aria-label="Clear conversation"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                                </svg>
                            </button>
                        )}

                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                            placeholder="Ask about task management..."
                            className="flex-1 bg-transparent py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none"
                            autoFocus
                        />

                        {/* Send icon — RIGHT side */}
                        <button
                            onClick={() => handleSend()}
                            disabled={loading || !prompt.trim()}
                            className="flex-shrink-0 text-[#4C3D8F] hover:text-[#3D3173] disabled:opacity-40 transition-colors p-1"
                            aria-label="Send message"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
