"use client";

import { useEffect, useRef } from "react";

export interface Message {
    role: "user" | "assistant";
    content: string;
}
// ⭐ Message type defined ONCE here — imported everywhere it's needed
// No more duplicate interface definitions in dashboard and ai-chat

interface AiMessageListProps {
    messages: Message[];
    loading: boolean;
    // 👆 Both passed from parent — this component only DISPLAYS
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    // 👆 Parent passes its scroll ref — component attaches it to the container
    // This way each parent controls its own scroll container
}

export default function AiMessageList({
    messages,
    loading,
    scrollContainerRef,
}: AiMessageListProps) {

    // Auto-scroll whenever messages or loading state changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages, loading]);
    // 👆 useEffect still uses the ref — but ref is now on PARENT div, not here
    // 👆 Defined ONCE here — no more duplicate useEffect in both pages

    return (
        <div
            className="flex flex-col gap-3"
        // 👆 Remove overflow-y-auto here — parent controls scroll container
        // The parent div (dashboard panel OR ai-chat page) owns the scroll
        >
            {/* Conversation messages */}
            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                    <div
                        className={`max-w-[85%] px-3 py-2.5 rounded-xl text-sm leading-relaxed ${msg.role === "user"
                            ? "bg-[#4C3D8F] text-white rounded-br-sm"
                            : "bg-[#F8F7FF] border border-[#E8E5FF] text-[#1E293B] rounded-bl-sm"
                            }`}
                    >
                        {msg.role === "assistant" && (
                            <p className="text-[10px] font-medium text-[#4C3D8F] mb-1">AI Assistant</p>
                        )}
                        <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
                    </div>
                </div>
            ))}

            {/* Loading dots — three bounce animation */}
            {loading && (
                <div className="flex justify-start">
                    <div className="bg-[#F8F7FF] border border-[#E8E5FF] px-3 py-2.5 rounded-xl rounded-bl-sm flex items-center gap-2">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 bg-[#4C3D8F] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <p className="text-[12px] text-[#4C3D8F]">Thinking...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
