import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        // 👆 NEW — capture this as a plain string variable RIGHT HERE
        // TypeScript now knows `userId` is definitely a string, not possibly undefined
        // Once we're inside the transaction, we use `userId` instead of `session.user.id`

        const { taskIds, newPriority } = await request.json();
        // 👆 Frontend sends: { taskIds: ["id1", "id2", "id3"], newPriority: "High" }

        if (!taskIds || taskIds.length === 0) {
            return NextResponse.json(
                { success: false, message: "No tasks selected" },
                { status: 400 }
            );
        }

        // ⭐ TRANSACTION — both operations succeed together, or neither happens
        const result = await prisma.$transaction(async (tx) => {

            const updateResult = await tx.task.updateMany({
                // 👆 updateMany — like update(), but for MULTIPLE rows matching a condition
                where: {
                    id: { in: taskIds },
                    // 👆 { in: [...] } — Prisma's way of saying "id matches ANY of these values"
                    // Similar to SQL's "WHERE id IN ('id1', 'id2', 'id3')"
                    userId: userId
                    // ⭐ CRITICAL — still scoping to the logged-in user!
                    // Prevents updating someone ELSE's tasks even if their id was somehow included
                },
                data: { priority: newPriority }
            });

            await tx.activityLog.create({
                data: {
                    action: "BULK_PRIORITY_UPDATE",
                    details: `Updated ${updateResult.count} tasks to ${newPriority} priority`,
                    userId: userId
                }
            });
            // 👆 If THIS fails (e.g., a typo, a constraint violation),
            // Prisma automatically UNDOES the updateMany() above too!
            // Without a transaction, you'd have updated tasks but NO log entry — inconsistent state

            return updateResult;
        });

        return NextResponse.json({
            success: true,
            message: `${result.count} tasks updated to ${newPriority} priority`
        });

    } catch (error) {
        console.error("PUT /api/tasks/bulk-priority error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update tasks" },
            { status: 500 }
        );
    }
}