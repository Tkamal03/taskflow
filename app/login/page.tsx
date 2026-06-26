"use client";
// 👆 Client Component — needs useState and signIn

import Toast from "@/app/components/Toast";
import { useState } from "react";
import { signIn } from "next-auth/react";
// 👆 signIn — NextAuth function to authenticate user
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    async function handleLogin() {
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            // 👆 "credentials" — matches our Credentials provider in auth.ts
            email,
            password,
            redirect: false
            // 👆 redirect: false — we handle redirect manually
            // If true NextAuth auto redirects (we lose control)
        });

        if (result?.error) {
            setError("Invalid email or password");
            // 👆 Don't tell user WHICH is wrong — security best practice!
            setToast({ message: "Invalid email or password", type: "error" });
            setLoading(false);
        } else {
            setToast({ message: "Login successful! Redirecting...", type: "success" });
            setTimeout(() => {
                router.push("/dashboard");
                // 👆 Redirect to dashboard after successful login
                router.refresh();
                // 👆 refresh() — updates server session in browser
            }, 800);
            // 👆 Short 800ms delay — just enough for the user to see the toast
            // before the page navigates away
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#EEF4FC] via-[#DCE9FA] to-[#CFE0F7]">
            {/* 👆 NEW — icy blue gradient background, replaces old indigo gradient
             Three color stops (from/via/to) create smoother depth than a 2-stop gradient */}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="w-full max-w-5xl flex rounded-[28px] overflow-hidden shadow-2xl border border-white/60 bg-white/55 backdrop-blur-xl">
                {/* 👆 NEW — this whole wrapper replaces the old single white card
               backdrop-blur-xl = the actual "glass" effect (blurs whatever is behind it)
               bg-white/55 = white at 55% opacity, lets background show through
               border-white/60 = soft white border, catches light like real glass */}

                {/* LEFT PANEL — NEW signature visual, didn't exist in old version */}
                <div className="hidden md:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#C9DDF8] via-[#AECBF2] to-[#97BCEE]">
                    {/* 👆 hidden md:flex — hides this entire panel on mobile screens,
                 shows it only on medium screens and up (md: breakpoint)
                 Keeps mobile experience simple — just the form, no decorative panel */}

                    {/* Glowing wave lines — purely decorative, echoes the app's "flow" concept */}
                    <svg className="absolute left-[-20px] right-[-20px] top-[140px] w-[calc(100%+40px)] opacity-50" height="80" viewBox="0 0 500 80" preserveAspectRatio="none">
                        <path d="M0,40 Q125,10 250,40 T500,40" stroke="white" strokeWidth="2" fill="none" />
                    </svg>
                    <svg className="absolute left-[-20px] right-[-20px] top-[200px] w-[calc(100%+40px)] opacity-30" height="80" viewBox="0 0 500 80" preserveAspectRatio="none">
                        <path d="M0,50 Q125,20 250,50 T500,50" stroke="white" strokeWidth="2" fill="none" />
                    </svg>

                    {/* The glass cube — THE signature element of this design */}
                    <div
                        className="absolute w-32 h-32 top-1/2 left-1/2 rounded-2xl border border-white/80 backdrop-blur-md"
                        style={{
                            transform: "translate(-50%, -55%) rotate(8deg)",
                            background: "linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.15))",
                            boxShadow: "0 20px 50px rgba(60,100,180,0.25)"
                            // 👆 Inline style here because Tailwind doesn't have a clean utility
                            // for this exact gradient + transform combo — mixing Tailwind classes
                            // with inline style is fine for one-off cases like this
                        }}
                    />

                    <div className="relative z-10 flex items-center gap-2">
                        {/* 👆 relative z-10 — keeps logo ABOVE the decorative waves/cube,
                   which are positioned absolute and could otherwise overlap it */}
                        {/* ⭐ UPDATED LOGO — same interlocking flow mark used across the whole app */}
                        <div className="w-8 h-8 rounded-[10px] bg-[#4C3D8F] flex items-center justify-center">
                            {/* 👆 CHANGED — solid #4C3D8F, matches the dashboard's logo exactly */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                {/* 👆 ALSO CHANGED — using the same interlocking flow loop icon 
           as the dashboard, instead of the old checkmark icon */}
                                <path d="M8 6C5.5 6 4 8 4 10.5C4 13 6 15 8.5 15C11 15 13 13 13 10.5"
                                    stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                                <path d="M16 18C18.5 18 20 16 20 13.5C20 11 18 9 15.5 9C13 9 11 11 11 13.5"
                                    stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                            </svg>
                        </div>
                        <span className="text-lg font-semibold text-[#1E3A5F] font-display">
                            TaskFlow
                        </span>
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-[28px] font-semibold text-[#1E3A5F] leading-snug mb-2 font-display">
                            Built to keep<br />you moving.
                        </h2>
                        <p className="text-sm text-[#3D5A80]">Plan it, track it, and watch every task make its way to done.</p>
                    </div>
                </div>

                {/* RIGHT PANEL — Form (same structure as old version, new visual styling) */}
                <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col justify-center">

                    <h1 className="text-3xl font-semibold text-[#1E293B] mb-2 font-display">
                        Welcome back
                    </h1>
                    <p className="text-[#64748B] text-sm mb-8">
                        Sign in to keep your tasks moving.
                    </p>

                    <div className="flex flex-col gap-4">
                        {/* 👆 SAME flex flex-col gap-4 structure as your old version —
                   just renamed div, same form field grouping pattern */}

                        <div>
                            <label className="text-sm font-medium text-[#334155] mb-1.5 block">
                                Email address
                            </label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/60 border border-[#D6E4F5] rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:border-[#3B6FE0] focus:ring-1 focus:ring-[#3B6FE0] transition-colors"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                {/* 👆 NEW — "Forgot password?" link added next to Password label,
                       wasn't in your original version */}
                                <label className="text-sm font-medium text-[#334155]">
                                    Password
                                </label>
                                <Link href="/forgot-password" className="text-xs text-[#3B82F6] hover:text-[#2563EB] transition-colors">
                                    {/* 👆 Points to the real route we'll build tomorrow — clicking it 
         will just 404 for today, which is honest and expected, 
         rather than the misleading href="#" that does nothing visibly */}
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/60 border border-[#D6E4F5] rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:border-[#3B6FE0] focus:ring-1 focus:ring-[#3B6FE0] transition-colors"
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                                ❌ {error}
                            </p>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm py-3 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(76,61,143,0.3)] disabled:opacity-50"
                        // 👆 CHANGED — same #4C3D8F purple now used across the entire app
                        // (logo, avatar, Add task buttons, and now Sign in)
                        >
                            {loading ? "Signing in..." : "Sign in"}
                            {!loading && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <p className="text-center text-sm text-[#64748B] mt-8">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
                            Register here
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}