"use client";
// 👆 Client Component — uses useEffect for the auto-dismiss timer

import { useEffect } from "react";

interface ToastProps {
    message: string;
    type: "success" | "error";
    // 👆 Union type — type can ONLY be one of these two strings
    // TypeScript will error if you try to pass type="warning" — keeps it safe
    onClose: () => void;
    // 👆 Function with no params, returns nothing — called when toast should close
}

export default function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
            // 👆 After 3 seconds, automatically call onClose
        }, 3000);

        return () => clearTimeout(timer);
        // 👆 Cleanup function — runs if component unmounts BEFORE 3 seconds
        // Prevents calling onClose on a component that no longer exists
        // (avoids a common React warning/bug)
    }, [onClose]);
    // 👆 Dependency array — re-runs effect only if onClose function changes

    return (
        <div
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-white font-semibold animate-slide-in ${type === "success" ? "bg-green-600" : "bg-red-600"
                // 👆 Conditional background color based on toast type
                }`}
        // 👆 fixed + top-6 right-6 — positions toast in top-right corner
        // z-50 — ensures it floats ABOVE all other page content
        >
            <span>{type === "success" ? "✅" : "❌"}</span>
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 text-white/80 hover:text-white">
                ✕
                {/* 👆 Manual close button — user doesn't have to wait 3 seconds */}
            </button>
        </div>
    );
}