import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { query } = await request.json();
        // 👆 The user's search text e.g. "urgent bug"

        if (!query?.trim()) {
            return NextResponse.json(
                { success: false, message: "Search query is required" },
                { status: 400 }
            );
        }

        // Step 1: Convert the search query into a vector
        // ────────────────────────────────────────────────
        const queryEmbedding = await generateEmbedding(query);
        // 👆 Same function we use for tasks!
        // "urgent bug" → [0.3, 0.7, 0.2, ...] (1536 numbers)
        // We need this vector to COMPARE against task vectors

        const queryVector = `[${queryEmbedding.join(",")}]`;
        // 👆 Convert the array to a string pgvector understands
        // [0.3, 0.7, 0.2] → "[0.3,0.7,0.2]"

        // Step 2: Find the most similar tasks using vector search
        // ────────────────────────────────────────────────────────
        const similarTasks = await prisma.$queryRaw<
            {
                id: string;
                title: string;
                description: string | null;
                priority: string;
                status: string;
                similarity: number;
            }[]
        >`
      SELECT 
        id,
        title,
        description,
        priority,
        status,
        1 - (embedding <=> ${queryVector}::vector) AS similarity
      FROM "Task"
      WHERE "userId" = ${session.user.id}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT 5
    `;
        // 👆 This is the CORE of RAG — let me explain each part:
        //
        // embedding <=> ${queryVector}::vector
        // ──────────────────────────────────────
        // <=>  is the "cosine distance" operator from pgvector
        //      It measures how FAR APART two vectors are
        //      0 = identical meaning, 1 = completely different
        //      (like GPS distance between two locations)
        //
        // 1 - (embedding <=> ...)  gives us SIMILARITY instead
        //      1 = identical meaning, 0 = completely different
        //      We flip it so higher number = better match
        //      This is what we return as "similarity score"
        //
        // ORDER BY embedding <=> ...
        //      Sort by distance — CLOSEST vectors first
        //      = most semantically similar tasks first
        //
        // LIMIT 5
        //      Return only the top 5 most similar tasks
        //      We don't want to overwhelm the AI with too much context
        //
        // AND embedding IS NOT NULL
        //      Skip tasks that haven't been embedded yet
        //      (just in case backfill wasn't run)

        return NextResponse.json({
            success: true,
            results: similarTasks,
            // 👆 Array of tasks ordered by similarity
            // Each task has a "similarity" score between 0 and 1
            query,
        });

    } catch (error) {
        console.error("Semantic search error:", error);
        return NextResponse.json(
            { success: false, message: "Search failed" },
            { status: 500 }
        );
    }
}
