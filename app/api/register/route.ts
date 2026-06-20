import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
// 👆 bcryptjs for hashing new passwords
import { validateEmail, validatePassword, validateName } from "@/lib/validation";
// 👆 SAME validators reused — this is why we made them reusable functions!

export async function POST(request: Request) {
    // 👆 Handle POST request to /api/register

    try {
        const { name, email, password } = await request.json();
        // 👆 Get user data from request body

        // ⭐ NEW — proper validation using our shared functions
        // Even if someone bypasses the frontend (e.g. calls API directly via Postman)
        // these checks still protect the database
        const nameError = validateName(name || "");
        const emailError = validateEmail(email || "");
        const passwordError = validatePassword(password || "");

        // Validate required fields
        if (nameError || emailError || passwordError) {
            return NextResponse.json(
                { success: false, message: nameError || emailError || passwordError },
                { status: 400 }
                // 👆 400 — Bad Request (missing fields)
            );
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
            // 👆 Check if someone already registered with this email
        });

        if (existingUser) {
            return NextResponse.json(
                { success: false, message: "Email already registered" },
                { status: 409 }
                // 👆 409 — Conflict (duplicate resource)
            );
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        // 👆 bcrypt.hash:
        // First param — plain text password
        // Second param — salt rounds (10 is recommended)
        // Higher number = more secure but slower
        // 10 is perfect balance for production!

        // Create user in database
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                // 👆 Store HASHED password — never plain text!
            }
        });

        return NextResponse.json({
            success: true,
            message: "Account created successfully!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
                // 👆 Never return password in response!
            }
        },
            { status: 201 }
            // 👆 201 — Created successfully
        );

    } catch (error) {
        return NextResponse.json(
            { success: false, message: "Something went wrong" },
            { status: 500 }
            // 👆 500 — Internal Server Error
        );
    }
}