"use client";

interface AiInputBoxProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    onSend: () => void;
    onClear: () => void;
    loading: boolean;
    hasMessages: boolean;
    // 👆 Controls whether clear icon is visible
    placeholder?: string;
    autoFocus?: boolean;
}

export default function AiInputBox({
    prompt,
    onPromptChange,
    onSend,
    onClear,
    loading,
    hasMessages,
    placeholder = "Ask about your tasks...",
    autoFocus = false,
}: AiInputBoxProps) {
    return (
        <div className="flex items-center gap-2 bg-white border border-[#DCE7F5] rounded-xl px-3.5 focus-within:border-[#4C3D8F] focus-within:ring-1 focus-within:ring-[#4C3D8F] transition-colors">

            {/* ⭐ Clear icon — LEFT side, only shows when conversation has messages */}
            {/* {hasMessages && (
                <button
                    onClick={onClear}
                    className="flex-shrink-0 text-[#94A3B8] hover:text-rose-400 transition-colors"
                    title="Clear conversation"
                    aria-label="Clear conversation"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                </button>
            )} */}

            {/* Text input */}
            <input
                type="text"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && onSend()}
                placeholder={hasMessages ? "Continue the conversation..." : placeholder}
                // 👆 Placeholder changes based on conversation state
                className="flex-1 bg-transparent py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none"
                autoFocus={autoFocus}
                disabled={loading}
            />

            {/* ⭐ Send icon — RIGHT side */}
            <button
                onClick={onSend}
                disabled={loading || !prompt.trim()}
                className="flex-shrink-0 text-[#4C3D8F] hover:text-[#3D3173] disabled:opacity-40 transition-colors"
                aria-label="Send message"
            >
                {loading ? (
                    <div className="w-4 h-4 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin" />
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
