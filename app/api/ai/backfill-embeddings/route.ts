import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateEmbedding, buildTaskText } from "@/lib/embeddings";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        // Step 1: Find all tasks that have NO embedding yet
        // ─────────────────────────────────────────────────
        const tasksWithoutEmbeddings = await prisma.$queryRaw<
            { id: string; title: string; description: string | null; priority: string; status: string }[]
        >`
  SELECT id, title, description, priority, status
  FROM "Task"
  WHERE "userId" = ${session.user.id}
  AND embedding IS NULL
`;
        // 👆 Added priority and status to SELECT
        // so buildTaskText can use them
        // 👆 $queryRaw — used when we need to SELECT data using custom SQL
        //    that Prisma doesn't support natively (like checking vector IS NULL)
        //
        //    Breaking down the SQL:
        //    SELECT id, title, description → get only these 3 columns
        //    FROM "Task"                   → from the Task table
        //    WHERE "userId" = ...          → only THIS user's tasks
        //    AND embedding IS NULL         → only tasks with no vector yet
        //
        //    The <{ id, title, description }[]> part tells TypeScript
        //    what shape the results will be — an array of objects
        //    with those 3 fields

        if (tasksWithoutEmbeddings.length === 0) {
            return NextResponse.json({
                success: true,
                message: "All tasks already have embeddings!",
                processed: 0,
            });
            // 👆 Nothing to do — all tasks already embedded
        }

        // Step 2: Generate embedding for each task one by one
        // ────────────────────────────────────────────────────
        let processed = 0;
        let failed = 0;

        for (const task of tasksWithoutEmbeddings) {
            // 👆 Loop through each task that needs embedding
            // We process ONE at a time (not all at once) to avoid
            // hitting OpenAI rate limits with too many requests simultaneously
            try {
                const text = buildTaskText(task.title, task.description, task.priority, task.status);
                // 👆 Combines title + description: "Fix login bug. Users can't sign in"

                const embedding = await generateEmbedding(text);
                // 👆 Calls OpenAI → returns array of 1536 numbers

                await prisma.$executeRaw`
          UPDATE "Task"
          SET embedding = ${`[${embedding.join(",")}]`}::vector
          WHERE id = ${task.id}
        `;
                // 👆 $executeRaw — used when we want to UPDATE/INSERT/DELETE
                //    using custom SQL (no return value needed)
                //
                //    Breaking down the SQL:
                //    UPDATE "Task"           → update the Task table
                //    SET embedding = ...     → set the embedding column
                //    ::vector                → cast (convert) our string
                //                             "[0.1, 0.2, ...]" into pgvector type
                //                             PostgreSQL needs this cast because
                //                             it doesn't know it's a vector automatically
                //    WHERE id = ${task.id}   → only update THIS specific task
                //
                //    embedding.join(",") converts [0.1, 0.2, 0.3]
                //    into the string "0.1,0.2,0.3"
                //    Then we wrap it in [] to get "[0.1,0.2,0.3]"
                //    which is what pgvector expects

                processed++;
                // 👆 Count how many we successfully processed

            } catch (error) {
                console.error(`Failed to embed task ${task.id}:`, error);
                failed++;
                // 👆 If one task fails, continue to the next one
                // Don't stop the whole backfill for one failure
            }
        }

        return NextResponse.json({
            success: true,
            message: `Backfill complete!`,
            processed,
            // 👆 How many tasks successfully got embeddings
            failed,
            // 👆 How many tasks failed (should be 0 normally)
            total: tasksWithoutEmbeddings.length,
        });

    } catch (error) {
        console.error("Backfill error:", error);
        return NextResponse.json(
            { success: false, message: "Backfill failed" },
            { status: 500 }
        );
    }
}
