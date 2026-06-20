import { auth } from "@/auth";
// 👆 Import auth from our NextAuth config
import { NextResponse } from "next/server";

export default auth((request) => {
    // 👆 auth() wraps our middleware with session checking

    const isLoggedIn = !!request.auth;
    // 👆 !! converts to boolean
    // request.auth exists = logged in = true
    // request.auth is null = not logged in = false

    const { pathname } = request.nextUrl;
    // 👆 Get current URL path

    const protectedRoutes = ["/dashboard"];
    // 👆 Only logged in users can access these

    const authRoutes = ["/login", "/register"];
    // 👆 Logged in users shouldn't see these

    // ⭐ Handle root path "/"
    if (pathname === "/") {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
            // 👆 Logged in + visiting "/" → send to dashboard
        } else {
            return NextResponse.redirect(new URL("/login", request.url));
            // 👆 Not logged in + visiting "/" → send to login
        }
    }

    if (protectedRoutes.some(route => pathname.startsWith(route)) && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", request.url));
        // 👆 Not logged in + trying dashboard = redirect to login
    }

    if (authRoutes.some(route => pathname.startsWith(route)) && isLoggedIn) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
        // 👆 Already logged in + trying login/register = redirect to dashboard
    }

    return NextResponse.next();
    // 👆 All checks passed — allow request to continue
});

export const config = {
    matcher: ["/", "/dashboard/:path*", "/login", "/register"]
    // 👆 Only run proxy on these routes
    // Other routes like / are not checked
};