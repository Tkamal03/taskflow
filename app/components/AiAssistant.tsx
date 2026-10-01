"use client";
// 👆 Client Component — needs useState for form interaction

import { useState } from "react";

// ⭐ NEW — defining a type for each message in the conversation
interface Message {
  role: "user" | "assistant";
  // 👆 "user" = what Kamal typed, "assistant" = what AI replied
  // Union type — role can ONLY be one of these two exact strings
  content: string;
  // 👆 The actual text content of the message
}

export default function AiAssistant() {
  const [prompt, setPrompt] = useState("");
  // 👆 Tracks what the user is currently typing in the input box
  // Updates on every keystroke via onChange

  const [messages, setMessages] = useState<Message[]>([]);
  // ⭐ NEW — stores the FULL conversation history as an array of Message objects
  // Each message has a role ("user" or "assistant") and content (the text)
  // This replaces the old single `response` string state
  // Starts as empty array [] — no messages until user sends something

  const [loading, setLoading] = useState(false);
  // 👆 Controls the loading state while waiting for AI response
  // true = show "Thinking..." state, false = show normal UI

  const [error, setError] = useState("");
  // 👆 Stores any error message to show the user
  // Empty string = no error showing

  async function handleAskAI() {
    if (!prompt.trim()) return;
    // 👆 Don't send empty prompts — .trim() removes whitespace

    const userMessage: Message = { role: "user", content: prompt };
    // 👆 Build the new user message object first
    // Typed as Message interface — guarantees correct shape

    const updatedMessages = [...messages, userMessage];
    // 👆 Add new user message to the existing conversation history
    // Spread operator (...) copies all existing messages,
    // then we append the new user message at the end
    // We store this in a variable because React state updates are async —
    // we need this updated array immediately for the API call below

    setMessages(updatedMessages);
    // 👆 Update UI immediately — user sees their message
    // appear in the chat BEFORE the AI responds (optimistic update)

    setPrompt("");
    // ⭐ NEW — auto-clear the input box after sending
    // This was in your pending UI notes from Day 2!

    setLoading(true);
    // 👆 Show loading state while waiting for AI response

    setError("");
    // 👆 Clear any previous error before new request

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        // 👆 POST — we're sending data (the prompt) to the server
        headers: { "Content-Type": "application/json" },
        // 👆 Tells server we're sending JSON format
        body: JSON.stringify({
          prompt,
          history: messages
          // ⭐ NEW — sending conversation HISTORY along with the new prompt
          // The backend uses this to give the AI context about
          // what was said before in this session
          // Note: we send `messages` (before this message) not `updatedMessages`
          // because the backend adds the current prompt separately
        })
      });

      const data = await res.json();
      // 👆 Parse the JSON response from our backend

      if (data.success) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.message
          // 👆 data.message contains the AI's actual reply text
        };
        setMessages([...updatedMessages, assistantMessage]);
        // ⭐ NEW — Add AI's reply to the conversation history
        // We use `updatedMessages` (which already includes the user's message)
        // NOT the old `messages` state — because React state updates are async,
        // `messages` at this point might not yet reflect the user message we added!
      } else {
        setError(data.message || "Something went wrong");
        // 👆 Show the error message from the backend
        setMessages(messages);
        // 👆 Roll back to previous messages if request failed
        // Remove the optimistically added user message
      }
    } catch (err) {
      setError("Failed to connect to AI. Please try again.");
      // 👆 Network-level error (no response at all from server)
      setMessages(messages);
      // 👆 Roll back optimistic update on network error too
    } finally {
      setLoading(false);
      // 👆 Always turn off loading, whether success or error
      // `finally` runs regardless of try/catch outcome
    }
  }

  function handleClearChat() {
    setMessages([]);
    // ⭐ NEW — reset conversation history to empty
    setPrompt("");
    // 👆 Clear the input box too
    setError("");
    // 👆 Clear any error messages
    // This lets user start a completely fresh conversation
  }

  return (
    <div className="bg-white/55 backdrop-blur-md border border-white/70 rounded-2xl p-5 mt-6">
      {/* 👆 Same frosted glass style as our task list — consistent with app theme */}

      {/* Header row — title + clear chat button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4C3D8F] flex items-center justify-center flex-shrink-0">
            {/* 👆 Same purple as our logo/buttons — consistent branding */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-[#1E293B]">AI Task Assistant</h2>
        </div>

        {/* ⭐ NEW — Clear chat button, only shows when there ARE messages */}
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-xs text-[#94A3B8] hover:text-[#4C3D8F] transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* ⭐ NEW — Conversation history display (shows when messages exist) */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3 mb-4 max-h-[320px] overflow-y-auto">
          {/* 👆 max-h-[320px] — caps height so chat doesn't grow infinitely
               overflow-y-auto — adds scrollbar when messages exceed the height */}

          {messages.map((msg, index) => (
            <div
              key={index}
              // 👆 index as key is acceptable here since messages only
              // get added, never reordered or removed mid-conversation
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              // 👆 User messages align RIGHT (like WhatsApp/iMessage)
              // AI messages align LEFT — classic chat UI pattern
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#4C3D8F] text-white rounded-br-sm"
                    : "bg-[#F8F7FF] border border-[#E8E5FF] text-[#1E293B] rounded-bl-sm"
                  // 👆 User bubbles: purple background, white text
                  // AI bubbles: soft purple-tinted white, dark text
                  // rounded-br-sm / rounded-bl-sm — removes ONE corner radius
                  // to create the classic "chat bubble tail" effect
                }`}
              >
                {msg.role === "assistant" && (
                  <p className="text-xs font-medium text-[#4C3D8F] mb-1">AI Assistant</p>
                  // 👆 Only show the "AI Assistant" label on AI messages
                  // User messages don't need a label — the purple bubble makes it obvious
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {/* 👆 whitespace-pre-wrap — preserves the line breaks (\n\n)
                     that the AI puts in its formatted responses
                     Without this, everything appears as one unformatted block */}
              </div>
            </div>
          ))}

          {/* Loading bubble — shows INSIDE the chat while waiting for AI */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F8F7FF] border border-[#E8E5FF] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin" />
                {/* 👆 Spinning circle animation — border-t-transparent creates
                     the "gap" in the circle that makes it look like it's spinning */}
                <p className="text-sm text-[#4C3D8F]">AI is thinking...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state when NO messages yet (very first message only) */}
      {loading && messages.length === 0 && (
        <div className="flex items-center gap-2 py-3 px-4 bg-[#F8F7FF] rounded-xl border border-[#E8E5FF] mb-3">
          <div className="w-4 h-4 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-[#4C3D8F]">AI is thinking...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="py-3 px-4 bg-rose-50 border border-rose-200 rounded-xl mb-3">
          <p className="text-sm text-rose-600">{error}</p>
          {/* 👆 Shows error directly below the chat, above the input box */}
        </div>
      )}

      {/* Input row — always visible at the bottom */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          // 👆 Controlled input — value always reflects prompt state
          onKeyDown={(e) => e.key === "Enter" && !loading && handleAskAI()}
          // 👆 Allow pressing Enter to submit
          // !loading check prevents sending while AI is still thinking
          placeholder={messages.length === 0
            ? "Ask AI for task management advice..."
            : "Continue the conversation..."
            // 👆 Placeholder changes contextually — first message vs follow-up
          }
          className="flex-1 bg-white/70 border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#4C3D8F] focus:ring-1 focus:ring-[#4C3D8F] transition-colors"
        />
        <button
          onClick={handleAskAI}
          disabled={loading || !prompt.trim()}
          // 👆 Disabled when loading OR when input is empty
          className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Thinking..." : "Ask AI"}
          {/* 👆 Button text changes based on loading state */}
        </button>
      </div>
    </div>
  );
}
