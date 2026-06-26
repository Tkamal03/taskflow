import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ApiResponse } from "@/lib/types";


interface Tag {
    id: string;
    name: string;
    color: string;
}

// GET — fetch all available tags
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {

            const response: ApiResponse<never> = {
                // 👆 ApiResponse<never> — "never" here means 
                //    "this specific response will NEVER actually contain data"
                //    since this is the error branch — fits cleanly with our union type
                success: false,
                message: "Not authenticated"
            };
            return NextResponse.json(response, { status: 401 });
            // return NextResponse.json(
            //     { success: false, message: "Not authenticated" },
            //     { status: 401 }
            // );
        }

        const tags = await prisma.tag.findMany({
            orderBy: { name: "asc" }
        });
        // 👆 Tags aren't user-scoped in our simple design — 
        // they're shared/global labels anyone can use
        // (A more advanced design might scope tags per-user too, but
        //  for learning purposes, global tags keep this lesson focused)

        const response: ApiResponse<Tag[]> = {
            // 👆 ApiResponse<Tag[]> — NOW we specify T = Tag[]
            //    TypeScript will ENFORCE that `data` must be an array of Tag objects
            //    If we accidentally returned the wrong shape, TypeScript catches it!
            success: true,
            data: tags
        };

        return NextResponse.json(response);

        // return NextResponse.json({ success: true, data: tags });


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