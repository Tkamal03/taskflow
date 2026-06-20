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
                    Welcome Back 👋
                </h1>
                <p className="text-gray-500 text-center mb-6">
                    Login to manage your tasks
                </p>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="YourEmail@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Logging in..." : "Login 🔐"}
                    </button>
                </div>

                <p className="text-center text-gray-500 text-sm mt-6">
                    Don't have an account?{" "}
                    <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                        Register here
                    </Link>
                </p>

            </div>
        </main>
    );
}