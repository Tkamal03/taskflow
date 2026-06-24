import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// GET — fetch all available tags
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const tags = await prisma.tag.findMany({
            orderBy: { name: "asc" }
        });
        // 👆 Tags aren't user-scoped in our simple design — 
        // they're shared/global labels anyone can use
        // (A more advanced design might scope tags per-user too, but
        //  for learning purposes, global tags keep this lesson focused)

        return NextResponse.json({ success: true, data: tags });

    } catch (error) {
        console.error("GET /api/tags error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch tags" },
            { status: 500 }
        );
    }
}

// POST — create a new tag
export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { name, color } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json(
                { success: false, message: "Tag name is required" },
                { status: 400 }
            );
        }

        const tag = await prisma.tag.create({
            data: {
                name: name.trim(),
                color: color || "#3B82F6"
            }
        });

        return NextResponse.json(
            { success: true, data: tag },
            { status: 201 }
        );

    } catch (error: any) {
        if (error.code === "P2002") {
            // 👆 P2002 — Prisma's specific error code for "unique constraint violation"
            // This fires because we made `name` @unique on the Tag model!
            return NextResponse.json(
                { success: false, message: "A tag with this name already exists" },
                { status: 409 }
            );
        }

        console.error("POST /api/tags error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to create tag" },
            { status: 500 }
        );
    }
}