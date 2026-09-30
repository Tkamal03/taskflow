"use client";
// 👆 Client Component — needs useState for form interaction

import { useState } from "react";

export default function AiAssistant() {
    const [prompt, setPrompt] = useState("");
    // 👆 Tracks what the user is typing in the input box

    const [response, setResponse] = useState("");
    // 👆 Stores the AI's reply to display to the user

    const [loading, setLoading] = useState(false);
    // 👆 Controls the loading state while waiting for AI response

    const [error, setError] = useState("");
    // 👆 Stores any error message to show the user

    async function handleAskAI() {
        if (!prompt.trim()) return;
        // 👆 Don't send empty prompts

        setLoading(true);
        setError("");
        setResponse("");
        // 👆 Reset previous state before new request

        try {
            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
                // 👆 Same fetch call we tested in the console earlier —
                // now properly wired up to React state
            });

            const data = await res.json();

            if (data.success) {
                setResponse(data.message);
                // 👆 Store the AI's reply in state to render it
            } else {
                setError(data.message || "Something went wrong");
            }
        } catch (err) {
            setError("Failed to connect to AI. Please try again.");
        } finally {
            setLoading(false);
            // 👆 Always turn off loading, whether success or error
        }
    }

    return (
        <div className="bg-white/55 backdrop-blur-md border border-white/70 rounded-2xl p-5 mt-6">
            {/* 👆 Same frosted glass style as our task list — consistent with app theme */}

            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#4C3D8F] flex items-center justify-center flex-shrink-0">
                    {/* 👆 Same purple as our logo/buttons — consistent branding */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a10 10 0 1 0 10 10" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                </div>
                <h2 className="text-sm font-semibold text-[#1E293B]">AI Task Assistant</h2>
                {/* 👆 Clear label so users know what this panel does */}
            </div>

            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                    // 👆 Allow pressing Enter to submit — better UX than button-only
                    placeholder="Ask AI for task management advice..."
                    className="flex-1 bg-white/70 border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#4C3D8F] focus:ring-1 focus:ring-[#4C3D8F] transition-colors"
                />
                <button
                    onClick={handleAskAI}
                    disabled={loading || !prompt.trim()}
                    // 👆 Disabled when loading OR when input is empty
                    className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {loading ? "Thinking..." : "Ask AI"}
                    {/* 👆 "Thinking..." is friendlier than a generic spinner text
               — gives the user a sense of what's happening */}
                </button>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center gap-2 py-3 px-4 bg-[#F8F7FF] rounded-xl border border-[#E8E5FF]">
                    <div className="w-4 h-4 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    {/* 👆 Spinning circle — same CSS animation trick used across the web
               border-t-transparent creates the "gap" that makes it look like it's spinning */}
                    <p className="text-sm text-[#4C3D8F]">AI is thinking...</p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="py-3 px-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <p className="text-sm text-rose-600">{error}</p>
                </div>
            )}

            {/* AI Response */}
            {response && (
                <div className="py-3 px-4 bg-[#F8F7FF] border border-[#E8E5FF] rounded-xl">
                    {/* 👆 Soft purple-tinted background — subtly signals "this came from AI"
               without being jarring or off-brand */}
                    <p className="text-xs font-medium text-[#4C3D8F] mb-1.5">AI Assistant</p>
                    <p className="text-sm text-[#1E293B] whitespace-pre-wrap leading-relaxed">
                        {response}
                        {/* 👆 whitespace-pre-wrap — preserves the line breaks 
                (\n\n) that the AI puts in its formatted responses
                Without this, the entire response would appear as one 
                giant unformatted block of text */}
                    </p>
                </div>
            )}
        </div>
    );
}
