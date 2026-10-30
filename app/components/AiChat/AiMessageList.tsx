"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
// 👆 Renders markdown strings as real HTML elements
// **bold** → <strong>, bullet points → <ul><li>, etc.

import AiSuggestionChips from "./AiSuggestionChips";

export interface Message {
    role: "user" | "assistant";
    content: string;

    // ── RAG Info Badge fields (only on assistant messages from rag-chat) ──
    ragType?: string;
    // 👆 e.g. "Naive RAG" — undefined for agent-chat messages
    chunkType?: string;
    // 👆 e.g. "Document Specific Chunking"
    relevantTasksFound?: number;
    // 👆 e.g. 3 — how many tasks matched the query
    highestSimilarity?: number;
    // 👆 e.g. 87 — best match score as percentage
}
// ⭐ Message type defined ONCE here — imported everywhere it's needed

interface AiMessageListProps {
    messages: Message[];
    loading: boolean;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onSend?: (message: string) => void;
}

export default function AiMessageList({
    messages,
    loading,
    scrollContainerRef,
    onSend,
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

    return (
        <div className="flex flex-col gap-3">
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

                        {msg.role === "user" ? (
                            // User messages: plain text — no markdown needed
                            <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
                        ) : (
                            // AI messages: render markdown + RAG Info Badge
                            <>
                                {/* AI response text — rendered as markdown */}
                                {/* [&_p] = targets <p> elements inside this div */}
                                {/* [&_ul] = targets <ul>, [&_li] = targets <li>, etc. */}
                                {/* This is Tailwind v4's way to style child elements without a config file */}
                                <div className="text-[13px] leading-relaxed
                                    [&_p]:my-1
                                    [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc
                                    [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal
                                    [&_li]:my-0.5
                                    [&_strong]:font-semibold [&_strong]:text-[#1E293B]
                                    [&_code]:bg-[#E8E5FF] [&_code]:px-1 [&_code]:rounded [&_code]:text-[12px]">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>

                                {/* ── RAG Info Badge ─────────────────────────────── */}
                                {/* Only shows when ragType exists — i.e. rag-chat responses only */}
                                {/* Agent-chat responses won't have ragType → badge hidden automatically */}
                                {msg.ragType && (
                                    <div className="mt-2.5 pt-2 border-t border-[#E8E5FF]">
                                        {/* Badge label */}
                                        <p className="text-[9px] font-semibold text-[#9B8EC4] uppercase tracking-wider mb-1.5">
                                            RAG Info
                                        </p>

                                        {/* 4 badge pills in a row */}
                                        <div className="flex flex-wrap gap-1.5">

                                            {/* RAG Type pill */}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDE9FF] text-[10px] font-medium text-[#4C3D8F]">
                                                🔍 {msg.ragType}
                                            </span>

                                            {/* Chunk Type pill */}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDE9FF] text-[10px] font-medium text-[#4C3D8F]">
                                                📄 {msg.chunkType}
                                            </span>

                                            {/* Tasks Found pill */}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDE9FF] text-[10px] font-medium text-[#4C3D8F]">
                                                📋 {msg.relevantTasksFound ?? 0} Tasks Found
                                            </span>

                                            {/* Similarity pill — only show when at least 1 task was found */}
                                            {/* If 0 tasks found, similarity is 0 — no point showing it */}
                                            {(msg.relevantTasksFound ?? 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDE9FF] text-[10px] font-medium text-[#4C3D8F]">
                                                    💯 {msg.highestSimilarity}% Match
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ))}

            {/* ⭐ Show suggestion chips after last AI message */}
            {messages.length > 0 &&
                messages[messages.length - 1].role === "assistant" &&
                !loading &&
                onSend &&
                messages.length <= 6 && (
                    <div className="flex justify-start pl-1">
                        <AiSuggestionChips
                            onSend={onSend}
                            disabled={loading}
                            askedQuestions={messages
                                .filter(m => m.role === "user")
                                .map(m => m.content)}
                        />
                    </div>
                )}

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