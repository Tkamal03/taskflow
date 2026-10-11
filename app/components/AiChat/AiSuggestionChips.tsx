"use client";

import { useState, useEffect, useRef } from "react";

interface AiSuggestionChipsProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    initialChips?: string[];
    askedQuestions?: string[];
}

const FALLBACK_CHIPS = [
    "⚡ What needs urgent attention?",
    "📊 How am I progressing?",
    "✅ Show my completed tasks",
    "🎯 What should I focus on today?",
];
// 👆 Static fallback chips — shown while dynamic ones load
// OR if the API call fails

export default function AiSuggestionChips({ onSend, disabled, initialChips, askedQuestions }: AiSuggestionChipsProps) {
    const [chips, setChips] = useState<string[]>(
        initialChips?.length ? initialChips : FALLBACK_CHIPS
    );
    // ⭐ If parent passed chips already → use them immediately, no lag!

    const [loadingChips, setLoadingChips] = useState(!initialChips?.length);
    // 👆 Only show loading if no initial chips provided

    const fetchedRef = useRef(false);
    // 👆 Prevents double API call in React StrictMode

    useEffect(() => {
        if (initialChips?.length) return;
        // ⭐ Parent already gave us chips — skip fetch entirely!

        if (fetchedRef.current) return;
        // 👆 Already fetched — prevent double call
        fetchedRef.current = true;

        async function fetchSuggestions() {
            try {
                const res = await fetch("/api/ai/suggest-questions", {
                    method: "POST",
                    // ⭐ Change to POST so we can send conversation history
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        askedQuestions: askedQuestions || []
                        // 👆 Tell API what was already asked
                    })
                });
                const data = await res.json();
                if (data.success && data.suggestions?.length > 0) {
                    setChips(data.suggestions);
                }
            } catch {
            } finally {
                setLoadingChips(false);
            }
        }
        fetchSuggestions();
    }, [initialChips]);

    return (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
            {chips.map((chip) => (
                <button
                    key={chip}
                    onClick={() => onSend(chip)}
                    disabled={disabled || loadingChips}
                    // 👆 Disabled while chips are loading OR AI is responding
                    className={`text-[11px] px-2.5 py-1.5 bg-white border border-[#DCE7F5] 
            rounded-full text-[#475569] transition-all
            ${loadingChips
                            ? "opacity-60 animate-pulse cursor-wait"
                            : "hover:border-[#4C3D8F] hover:text-[#4C3D8F] cursor-pointer"
                        }
            disabled:cursor-not-allowed`}
                // ⭐ animate-pulse while loading — chips subtly pulse
                // to show they're being personalised
                >
                    {chip}
                </button>
            ))}
        </div>
    );
}
