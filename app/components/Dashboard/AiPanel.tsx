"use client";

import AiMessageList from "@/app/components/AiChat/AiMessageList";
import AiInputBox from "@/app/components/AiChat/AiInputBox";
import AiSuggestionChips from "@/app/components/AiChat/AiSuggestionChips";
import { Message } from "@/app/components/AiChat/AiMessageList";
import AiChatDownload from "@/app/components/AiChat/AiChatDownload";
import { ChatMode } from "@/app/components/AiChat/useAiChat";
// 👆 Import ChatMode type so toggle button knows which mode is active

interface AiPanelProps {
    messages: Message[];
    prompt: string;
    loading: boolean;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onPromptChange: (value: string) => void;
    onSend: () => void;
    onSendChip: (text: string) => void;
    onClear: () => void;
    onClose: () => void;
    onExpand: () => void;
    suggestedChips?: string[];
    mode: ChatMode;
    // 👆 Current mode — "rag" or "agent"
    onModeChange: (mode: ChatMode) => void;
    // 👆 Called when user clicks the toggle button
}

export default function AiPanel({
    messages, prompt, loading, scrollContainerRef,
    onPromptChange, onSend, onSendChip, onClear, onClose, onExpand,
    suggestedChips, mode, onModeChange,
}: AiPanelProps) {
    return (
        <div className="bg-white/70 backdrop-blur-md border border-[#E8E5FF] rounded-2xl mb-4 animate-[slideDown_0.25s_ease-out] overflow-hidden">

            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E5FF]">
                <div className="flex items-center gap-2">
                    <img src="/ai-chat-icon.png" alt="AI" className="w-5 h-5 object-contain" />
                    <span className="text-sm font-semibold text-[#4C3D8F]">AI Task Assistant</span>
                </div>

                <div className="flex items-center gap-1.5">

                    {/* ⭐ Mode toggle — RAG vs Agent */}
                    <div className="flex items-center bg-[#F3F0FF] rounded-lg p-0.5 gap-0.5">
                        <button
                            onClick={() => onModeChange("rag")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mode === "rag"
                                    ? "bg-[#4C3D8F] text-white shadow-sm"
                                    : "text-[#4C3D8F] hover:bg-[#E8E5FF]"
                                }`}
                            title="RAG mode — semantic search through your tasks"
                        >
                            RAG
                        </button>
                        <button
                            onClick={() => onModeChange("agent")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mode === "agent"
                                    ? "bg-[#4C3D8F] text-white shadow-sm"
                                    : "text-[#4C3D8F] hover:bg-[#E8E5FF]"
                                }`}
                            title="Agent mode — create, update, delete tasks with AI"
                        >
                            Agent
                        </button>
                    </div>

                    {/* Download button */}
                    <AiChatDownload messages={messages} />

                    {/* Clear icon */}
                    {messages.length > 0 && (
                        <button
                            onClick={onClear}
                            className="w-7 h-7 rounded-lg bg-[#F8F7FF] hover:bg-[#EEF2FF] flex items-center justify-center transition-colors"
                            title="Clear conversation"
                            aria-label="Clear conversation"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                            </svg>
                        </button>
                    )}

                    {/* Expand icon */}
                    <button
                        onClick={onExpand}
                        className="w-7 h-7 rounded-lg bg-[#F8F7FF] hover:bg-[#EEF2FF] flex items-center justify-center transition-colors"
                        title="Open full screen"
                        aria-label="Open full AI chat page"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4C3D8F" strokeWidth="2" strokeLinecap="round">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                    </button>

                    {/* Close icon */}
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg bg-[#F8F7FF] hover:bg-[#EEF2FF] flex items-center justify-center transition-colors"
                        aria-label="Close AI panel"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div
                ref={scrollContainerRef}
                className="px-4 py-3 max-h-[280px] overflow-y-auto flex flex-col gap-3"
            >
                {messages.length === 0 && !loading && (
                    <div className="text-center py-4">
                        <p className="text-xs text-[#94A3B8]">
                            {mode === "agent"
                                ? "Create, update or delete tasks — just type naturally!"
                                : "Ask me anything about your tasks!"
                            }
                            {/* 👆 Hint text changes based on mode */}
                        </p>
                        <AiSuggestionChips
                            onSend={onSendChip}
                            disabled={loading}
                            initialChips={suggestedChips}
                        />
                    </div>
                )}
                <AiMessageList
                    messages={messages}
                    loading={loading}
                    scrollContainerRef={scrollContainerRef}
                    onSend={onSendChip}
                />
            </div>

            {/* Input */}
            <div className="px-4 pb-3 pt-2 border-t border-[#E8E5FF]">
                <AiInputBox
                    prompt={prompt}
                    onPromptChange={onPromptChange}
                    onSend={onSend}
                    onClear={onClear}
                    loading={loading}
                    hasMessages={messages.length > 0}
                    autoFocus={true}
                />
            </div>
        </div>
    );
}
