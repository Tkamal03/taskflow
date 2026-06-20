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

    // ⭐ NEW — field-specific errors instead of one generic error
    const [fieldErrors, setFieldErrors] = useState({
        name: "",
        email: "",
        password: ""
    });

    const [serverError, setServerError] = useState("");
    // 👆 Separate from fieldErrors — this is for errors FROM the API
    // (like "Email already registered" which frontend validation can't catch)

    // const [error, setError] = useState("");
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
        }
    }

    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">

                <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
                    Create Account 🚀
                </h1>
                <p className="text-gray-500 text-center mb-6">
                    Start managing your tasks today
                </p>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                            Full Name
                        </label>
                        <input
                            type="text"
                            placeholder="Your Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-1 ${fieldErrors.name
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                }`}
                        // 👆 Conditional styling — red border ONLY when there's an error
                        // This is a common professional UX pattern
                        />
                        {fieldErrors.name && (
                            <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                            // 👆 Shows error directly below the specific field it belongs to
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="Email@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-1 ${fieldErrors.email
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                }`}
                        />
                        {fieldErrors.email && (
                            <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="Minimum 6 characters"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-1 ${fieldErrors.password
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                }`}
                        />
                        {fieldErrors.password && (
                            <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>
                        )}
                    </div>

                    {serverError && (
                        <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                            ❌ {serverError}
                        </p>
                    )}

                    {success && (
                        <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">
                            ✅ {success}
                        </p>
                    )}

                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating Account..." : "Create Account 🚀"}
                    </button>
                </div>

                <p className="text-center text-gray-500 text-sm mt-6">
                    Already have an account?{" "}
                    <Link href="/login" className="text-blue-600 font-semibold hover:underline">
                        Login here
                    </Link>
                </p>

            </div>
        </main>
    );
}