"use client";

interface AiSuggestionChipsProps {
    onSend: (message: string) => void;
    // 👆 Receives the send function from parent
    // When chip clicked → directly calls onSend with the chip text
    disabled?: boolean;
    // 👆 Optional — disables chips while AI is loading
}

const DEFAULT_CHIPS = [
    "How do I prioritize tasks?",
    "What's most urgent?",
    "Help me stay focused",
    "Tips to beat procrastination",
];
// 👆 Defined once here — used in both dashboard panel and /ai-chat page
// No more copy-pasting the same chip list in two files

export default function AiSuggestionChips({ onSend, disabled }: AiSuggestionChipsProps) {
    return (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
            {DEFAULT_CHIPS.map((chip) => (
                <button
                    key={chip}
                    onClick={() => onSend(chip)}
                    // ⭐ Calls onSend directly — auto-sends, doesn't just populate input
                    // The parent (dashboard panel OR ai-chat page) provides the onSend function
                    // This component doesn't care WHERE it's used — just calls what it's given
                    disabled={disabled}
                    className="text-[11px] px-2.5 py-1.5 bg-white border border-[#DCE7F5] rounded-full text-[#475569] hover:border-[#4C3D8F] hover:text-[#4C3D8F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {chip}
                </button>
            ))}
        </div>
    );
}
