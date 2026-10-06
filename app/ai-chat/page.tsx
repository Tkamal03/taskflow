"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAiChat } from "@/app/components/AiChat/useAiChat";
import AiMessageList from "@/app/components/AiChat/AiMessageList";
import AiInputBox from "@/app/components/AiChat/AiInputBox";
import AiSuggestionChips from "@/app/components/AiChat/AiSuggestionChips";
// ⭐ All AI logic comes from shared components — this file is now a thin wrapper!

export default function AiChatPage() {
    const { data: session } = useSession();

    const {
        messages,
        setMessages,
        prompt,
        setPrompt,
        loading,
        scrollContainerRef,
        sendMessage,
        clearMessages,
    } = useAiChat();
    // ⭐ Same hook as dashboard panel — zero duplication

    // Restore conversation carried from dashboard panel
    useEffect(() => {
        const saved = sessionStorage.getItem("aiChatHistory");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    // 👆 Restore conversation from dashboard inline panel
                }
            } catch { }
            sessionStorage.removeItem("aiChatHistory");
            // 👆 Clear after restoring — don't restore again on refresh
        }
    }, []);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-[#EEF4FC] via-[#E3EDFA] to-[#DCE9FA]">

            {/* Header */}
            <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-6 py-3.5 flex items-center justify-between flex-shrink-0">

                {/* Left — icon + title */}
                <div className="flex items-center gap-2">
                    <img src="/ai-chat-icon.png" alt="AI" className="w-6 h-6 object-contain" />
                    <div>
                        <h1 className="text-sm font-semibold text-[#1E293B] font-display">
                            AI Task Assistant
                        </h1>
                        <p className="text-xs text-[#64748B]">
                            {session?.user?.name ? `Hello, ${session.user.name}` : "Your personal task advisor"}
                        </p>
                    </div>
                </div>

                {/* Right — back to dashboard icon */}
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

            {/* Chat messages — scrollable, flex-1 fills remaining space */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-4 py-6"
            // ⭐ ref on THIS div — only this scrolls, page stays still
            >
                <div className="max-w-2xl mx-auto">

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
                            {/* ⭐ Shared suggestion chips — auto-send on click */}
                            <AiSuggestionChips
                                onSend={sendMessage}
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* ⭐ Shared message list component */}
                    <AiMessageList
                        messages={messages}
                        loading={loading}
                        scrollContainerRef={scrollContainerRef}
                    />
                </div>
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 bg-white/55 backdrop-blur-md border-t border-white/70 px-4 py-4">
                <div className="max-w-2xl mx-auto">
                    {/* ⭐ Shared input box component */}
                    <AiInputBox
                        prompt={prompt}
                        onPromptChange={setPrompt}
                        onSend={() => sendMessage()}
                        onClear={clearMessages}
                        loading={loading}
                        hasMessages={messages.length > 0}
                        placeholder="Ask about task management..."
                        autoFocus={true}
                    />
                </div>
            </div>
        </div>
    );
}
