import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // ⭐ THE TRANSACTION — this is the new concept!
        const result = await prisma.$transaction(async (tx) => {
            // 👆 prisma.$transaction — wraps everything inside in ONE atomic unit
            // 👆 (tx) — a special version of prisma client, ONLY for use inside this transaction
            // We use "tx" instead of "prisma" for every query inside this block!

            const taskCount = await tx.task.count({
                where: { userId }
            });
            // 👆 Step 1 — count how many tasks this user has (just for logging/confirmation)

            await tx.task.deleteMany({
                where: { userId }
            });
            // 👆 Step 2 — delete ALL tasks belonging to this user
            // 👆 deleteMany — like delete(), but removes MULTIPLE matching rows at once

            const deletedUser = await tx.user.delete({
                where: { id: userId }
            });
            // 👆 Step 3 — delete the user record itself

            return { deletedUser, taskCount };
            // 👆 Whatever we return here becomes the final "result" outside the transaction
        });

        // 👆 If we reach THIS line, ALL THREE steps above succeeded together
        // If ANY of the three steps had thrown an error, Prisma automatically
        // rolls back ALL changes — as if none of it ever happened!

        return NextResponse.json({
            success: true,
            message: `Account deleted successfully. ${result.taskCount} tasks were also removed.`
        });

    } catch (error) {
        console.error("DELETE /api/account error:", error);
        // 👆 If transaction failed at ANY step, we land here
        // Database is guaranteed to be UNCHANGED — no partial deletion ever happened

        return NextResponse.json(
            { success: false, message: "Failed to delete account" },
            { status: 500 }
        );
    }
}