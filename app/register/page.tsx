"use client";
// 👆 Client Component — needs useState for form
import Toast from "@/app/components/Toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateEmail, validatePassword, validateName } from "@/lib/validation";
// 👆 Import our reusable validators

export default function RegisterPage() {
    const router = useRouter();
    // 👆 For redirecting after registration

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });
    // 👆 Single state object for all form fields
    // Cleaner than 3 separate useState calls

    // ⭐ field-specific errors instead of one generic error
    const [fieldErrors, setFieldErrors] = useState({
        name: "",
        email: "",
        password: ""
    });

    const [serverError, setServerError] = useState("");
    // 👆 Separate from fieldErrors — this is for errors FROM the API
    // (like "Email already registered" which frontend validation can't catch)

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    function validateForm(): boolean {
        // 👆 Returns true if form is valid, false if there are errors
        // Runs ALL validators and collects results

        const nameError = validateName(formData.name);
        const emailError = validateEmail(formData.email);
        const passwordError = validatePassword(formData.password);

        setFieldErrors({
            name: nameError || "",
            email: emailError || "",
            password: passwordError || ""
            // 👆 || "" converts null to empty string for display logic
        });

        return !nameError && !emailError && !passwordError;
        // 👆 true only if ALL three are null (no errors)
    }

    async function handleRegister() {
        setServerError("");
        setSuccess("");

        const isValid = validateForm();
        // 👆 Check frontend validation FIRST — before even calling the API
        // Saves an unnecessary network request if obviously invalid

        if (!isValid) {
            setToast({ message: "Please fix the errors in the form", type: "error" });
            // 👆 General toast — field-specific errors still show below each input
            return;
            // 👆 Stop here — fieldErrors are already set and will show in UI
        }

        setLoading(true);

        const response = await fetch("/api/register", {
            method: "POST",
            // 👆 POST — creating new user
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
            // 👆 JSON.stringify — converts object to JSON string
        });

        const data = await response.json();

        if (data.success) {
            setToast({ message: "Account created successfully!", type: "success" });
            setTimeout(() => router.push("/login"), 2000);
            // 👆 Wait 2 seconds then redirect to login
            // So user can see success message
        } else {
            setServerError(data.message);
            // 👆 This catches backend-only errors like "Email already registered"
            // Frontend validation has no way to know this without calling the API!

            setToast({ message: data.message, type: "error" });
            setLoading(false);
            // 👆 NOTE — added this here. In your original code, `loading` was 
            // never reset to false on the error path, which would leave the 
            // button stuck on "Creating Account..." forever after a failed attempt!
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#EEF4FC] via-[#DCE9FA] to-[#CFE0F7]">
            {/* 👆 Same icy blue gradient background as login */}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="w-full max-w-5xl flex rounded-[28px] overflow-hidden shadow-2xl border border-white/60 bg-white/55 backdrop-blur-xl">
                {/* 👆 Same glass card structure as login */}

                {/* LEFT PANEL — Signature visual (same as login, different copy) */}
                <div className="hidden md:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#C9DDF8] via-[#AECBF2] to-[#97BCEE]">

                    <svg className="absolute left-[-20px] right-[-20px] top-[140px] w-[calc(100%+40px)] opacity-50" height="80" viewBox="0 0 500 80" preserveAspectRatio="none">
                        <path d="M0,40 Q125,10 250,40 T500,40" stroke="white" strokeWidth="2" fill="none" />
                    </svg>
                    <svg className="absolute left-[-20px] right-[-20px] top-[200px] w-[calc(100%+40px)] opacity-30" height="80" viewBox="0 0 500 80" preserveAspectRatio="none">
                        <path d="M0,50 Q125,20 250,50 T500,50" stroke="white" strokeWidth="2" fill="none" />
                    </svg>

                    <div
                        className="absolute w-32 h-32 top-1/2 left-1/2 rounded-2xl border border-white/80 backdrop-blur-md"
                        style={{
                            transform: "translate(-50%, -55%) rotate(8deg)",
                            background: "linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.15))",
                            boxShadow: "0 20px 50px rgba(60,100,180,0.25)"
                        }}
                    />

                    <div className="relative z-10 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[10px] bg-[#4C3D8F] flex items-center justify-center">
                            {/* 👆 Same solid #4C3D8F logo used everywhere else in the app */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label="TaskFlow logo">
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
                        {/* ⭐ NEW — register-specific copy (different from login's tagline) */}
                        <h2 className="text-[28px] font-semibold text-[#1E3A5F] leading-snug mb-2 font-display">
                            Start where<br />ideas become done.
                        </h2>
                        <p className="text-sm text-[#3D5A80]">Create your account and bring your first task to life.</p>
                    </div>
                </div>

                {/* RIGHT PANEL — Form */}
                <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col justify-center">

                    <h1 className="text-3xl font-semibold text-[#1E293B] mb-2 font-display">
                        Create account
                    </h1>
                    <p className="text-[#64748B] text-sm mb-8">
                        Start managing your tasks today.
                    </p>

                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-medium text-[#334155] mb-1.5 block">
                                Full name
                            </label>
                            <input
                                type="text"
                                placeholder="Your name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full bg-white/60 border rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:ring-1 transition-colors ${fieldErrors.name
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                        : "border-[#D6E4F5] focus:border-[#4C3D8F] focus:ring-[#4C3D8F]"
                                    }`}
                            // 👆 Conditional styling — red border ONLY when there's an error
                            // Focus color now uses #4C3D8F instead of blue, matching app theme
                            />
                            {fieldErrors.name && (
                                <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                                // 👆 Shows error directly below the specific field it belongs to
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#334155] mb-1.5 block">
                                Email address
                            </label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className={`w-full bg-white/60 border rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:ring-1 transition-colors ${fieldErrors.email
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                        : "border-[#D6E4F5] focus:border-[#4C3D8F] focus:ring-[#4C3D8F]"
                                    }`}
                            />
                            {fieldErrors.email && (
                                <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[#334155] mb-1.5 block">
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="Minimum 6 characters"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className={`w-full bg-white/60 border rounded-xl px-4 py-3 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:ring-1 transition-colors ${fieldErrors.password
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                        : "border-[#D6E4F5] focus:border-[#4C3D8F] focus:ring-[#4C3D8F]"
                                    }`}
                            />
                            {fieldErrors.password && (
                                <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>
                            )}
                        </div>

                        {serverError && (
                            <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                                {serverError}
                            </p>
                        )}

                        {success && (
                            <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">
                                {success}
                            </p>
                        )}

                        <button
                            onClick={handleRegister}
                            disabled={loading}
                            className="w-full bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm py-3 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(76,61,143,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        // 👆 Same #4C3D8F app-wide color
                        >
                            {loading ? "Creating account..." : "Create account"}
                            {!loading && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <p className="text-center text-sm text-[#64748B] mt-8">
                        Already have an account?{" "}
                        <Link href="/login" className="text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
                            {/* 👆 Stays BLUE — same as login page's secondary links, per your earlier decision */}
                            Login here
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}