"use client";
// 👆 Client Component — needs useState for chat interaction

import { useState, useEffect, useRef } from "react";
// 👆 useRef — NEW here, we'll use it to auto-scroll to the 
//    latest message whenever a new one arrives

import { useSession } from "next-auth/react";
// 👆 To show the user's name in the greeting

import Link from "next/link";
// 👆 For the "Back to dashboard" navigation link

interface Message {
    role: "user" | "assistant";
    // 👆 Same Message type as our AiAssistant component
    content: string;
}

export default function AiChatPage() {
    const { data: session } = useSession();
    // 👆 Get current user's session for personalized greeting

    const [prompt, setPrompt] = useState("");
    // 👆 Tracks what user is currently typing

    const [messages, setMessages] = useState<Message[]>([]);
    // 👆 Full conversation history — same pattern as Day 3

    const [loading, setLoading] = useState(false);
    // 👆 Controls loading state while waiting for AI response

    const [error, setError] = useState("");
    // 👆 Stores any error to display to the user

    const messagesEndRef = useRef<HTMLDivElement>(null);
    // ⭐ NEW — a ref (reference) to an invisible div at the BOTTOM
    // of the messages list. We'll scroll to it whenever messages update
    // useRef gives us direct DOM access without causing re-renders
    // The <HTMLDivElement> type tells TypeScript what kind of element this is

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        // ⭐ NEW — auto-scroll to bottom whenever messages change
        // messagesEndRef.current = the actual DOM element
        // scrollIntoView — browser built-in that scrolls element into view
        // behavior: "smooth" — animated scroll, not instant jump
        // ?. optional chaining — safe if ref isn't attached yet
    }, [messages]);
    // 👆 Runs every time the messages array changes
    // (new user message added OR new AI reply received)

    async function handleSend() {
        if (!prompt.trim() || loading) return;
        // 👆 Don't send empty messages or send while already loading

        const userMessage: Message = { role: "user", content: prompt };
        const updatedMessages = [...messages, userMessage];
        // 👆 Same history-building pattern from Day 3

        setMessages(updatedMessages);
        setPrompt("");
        // 👆 Clear input immediately after sending
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/ai", {
                // 👆 Reusing our EXISTING /api/ai route — no new backend needed!
                // The dedicated page just gives a better UI, same AI logic underneath
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    history: messages
                    // 👆 Full conversation history for context — same as Day 3
                })
            });

            const data = await res.json();

            if (data.success) {
                const assistantMessage: Message = {
                    role: "assistant",
                    content: data.message
                };
                setMessages([...updatedMessages, assistantMessage]);
                // 👆 Add AI reply to conversation history
            } else {
                setError(data.message || "Something went wrong");
                setMessages(messages);
                // 👆 Roll back optimistic update on error
            }
        } catch (err) {
            setError("Failed to connect to AI. Please try again.");
            setMessages(messages);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-[#EEF4FC] via-[#E3EDFA] to-[#DCE9FA]">
            {/* 👆 Full screen height (h-screen) with our app's icy blue gradient
           flex flex-col — stacks header, chat area, and input vertically */}

            {/* Header */}
            <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
                {/* 👆 flex-shrink-0 — prevents header from shrinking
             when the chat area needs more space */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#4C3D8F] flex items-center justify-center">
                        {/* 👆 Same purple logo box — consistent with app branding */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M8 6C5.5 6 4 8 4 10.5C4 13 6 15 8.5 15C11 15 13 13 13 10.5"
                                stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                            <path d="M16 18C18.5 18 20 16 20 13.5C20 11 18 9 15.5 9C13 9 11 11 11 13.5"
                                stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                        </svg>
                        {/* 👆 Same interlocking loop logo we confirmed in the redesign session */}
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-[#1E293B] font-display">AI Task Assistant</h1>
                        <p className="text-xs text-[#64748B]">
                            {session?.user?.name ? `Hello, ${session.user.name}` : "Your personal task advisor"}
                        </p>
                        {/* 👆 Personalized greeting if user is logged in
                 Falls back to generic text if session not loaded yet */}
                    </div>
                </div>
                <Link
                    href="/dashboard"
                    className="text-sm text-[#4C3D8F] hover:text-[#3D3173] font-medium transition-colors flex items-center gap-1.5"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back to dashboard
                    {/* 👆 Always give users a clear way to navigate back
               Arrow icon makes it obvious this is a navigation link */}
                </Link>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                {/* 👆 flex-1 — takes all remaining space between header and input
             overflow-y-auto — scrollable when messages overflow
             This is the key layout trick for chat UIs:
             header (fixed height) + messages (flex-1, scrollable) + input (fixed height) */}

                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                    {/* 👆 max-w-2xl — constrains chat width for readability
               (very wide chat bubbles are hard to read)
               mx-auto — centers the chat column */}

                    {/* Empty state — shows when no messages yet */}
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

                            {/* Suggestion chips — quick-start prompts */}
                            <div className="flex flex-wrap gap-2 mt-6 justify-center">
                                {[
                                    "How do I prioritize tasks?",
                                    "Help me beat procrastination",
                                    "What is the Eisenhower Matrix?",
                                    "Tips for staying focused"
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setPrompt(suggestion)}
                                        // 👆 Clicking a suggestion fills the input box
                                        // User still presses Send — gives them a chance to edit first
                                        className="text-xs px-3 py-2 bg-white/70 border border-[#DCE7F5] rounded-full text-[#475569] hover:bg-white hover:border-[#4C3D8F] hover:text-[#4C3D8F] transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversation messages */}
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        // 👆 Same left/right alignment as our AiAssistant component
                        >
                            <div
                                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                        ? "bg-[#4C3D8F] text-white rounded-br-sm"
                                        : "bg-white/80 backdrop-blur-sm border border-white/70 text-[#1E293B] rounded-bl-sm"
                                    // ⭐ AI bubbles slightly different from dashboard panel —
                                    // using white glass effect instead of purple-tinted
                                    // Feels more premium on the dedicated page
                                    }`}
                            >
                                {msg.role === "assistant" && (
                                    <p className="text-xs font-medium text-[#4C3D8F] mb-1.5">AI Assistant</p>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {/* Loading bubble */}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white/80 backdrop-blur-sm border border-white/70 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                                <div className="flex gap-1">
                                    {/* ⭐ NEW — Three bouncing dots instead of spinner
                       More visually interesting for a dedicated chat page
                       Each dot has a different animation delay */}
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="w-2 h-2 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                                <p className="text-sm text-[#4C3D8F]">AI is thinking...</p>
                            </div>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="flex justify-center">
                            <div className="px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                                <p className="text-xs text-rose-600">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* ⭐ Invisible div at the bottom — auto-scroll target */}
                    <div ref={messagesEndRef} />
                    {/* 👆 This is what useEffect scrolls TO
               It has no visible content — purely a scroll anchor
               Lives at the very end of the messages list
               so scrollIntoView always brings us to the latest message */}
                </div>
            </div>

            {/* Input Area — fixed at bottom */}
            <div className="flex-shrink-0 bg-white/55 backdrop-blur-md border-t border-white/70 px-4 py-4">
                {/* 👆 flex-shrink-0 — prevents input from shrinking
             border-t — separates input from chat area visually */}
                <div className="max-w-2xl mx-auto flex gap-3">
                    {/* 👆 Same max-w-2xl — keeps input aligned with chat bubbles */}
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                        // 👆 Enter key to send — same as dashboard panel
                        placeholder="Ask about task management..."
                        className="flex-1 bg-white/70 border border-[#DCE7F5] rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#4C3D8F] focus:ring-1 focus:ring-[#4C3D8F] transition-colors"
                        autoFocus
                    // ⭐ NEW — autoFocus: cursor automatically lands in the
                    // input box when page loads — user can start typing immediately
                    // without clicking first. Good UX for a chat-focused page
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !prompt.trim()}
                        className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white px-5 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                            </svg>
                            // 👆 Paper plane send icon — universally recognized as "send"
                        )}
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
