import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
// 👆 bcryptjs — for comparing hashed passwords during login

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                // 👆 authorize — runs when user tries to login
                // Returns user object if valid, null if invalid

                const { email, password } = credentials as {
                    email: string;
                    password: string;
                };

                // Find user in REAL database
                const user = await prisma.user.findUnique({
                    where: { email }
                    // 👆 findUnique — finds one user by email
                    // Returns null if not found
                });

                if (!user) return null;
                // 👆 User not found — login fails

                // Compare password with stored hash
                const passwordMatch = await bcrypt.compare(password, user.password);
                // 👆 bcrypt.compare:
                // First param — what user typed
                // Second param — hash stored in DB
                // Returns true if they match!

                if (!passwordMatch) return null;
                // 👆 Wrong password — login fails

                // Return user data — stored in session
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            // 👆 jwt callback — runs when token is created
            // Add extra user data to token here
            if (user) {
                token.id = user.id;
                // 👆 Store user ID in token
                // Useful for DB queries later
            }
            return token;
        },
        async session({ session, token }) {
            // 👆 session callback — runs when session is accessed
            // Add token data to session here
            if (session.user) {
                (session.user as any).id = token.id;
                // 👆 Make user ID available in session
            }
            return session;
        }
    },
    pages: {
        signIn: "/login"
        // 👆 Use our custom login page
    }
});