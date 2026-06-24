import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

interface TaskStatRow {
    // 👆 Defining the shape as its OWN named interface first,
    // instead of inline — this avoids the generic/template-literal parsing conflict
    status: string;
    count: bigint;
    percentage: number;
}

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // ⭐ RAW SQL QUERY
        const stats = await prisma.$queryRaw<TaskStatRow[]>`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "Task" WHERE "userId" = ${userId}), 1) as percentage
      FROM "Task"
      WHERE "userId" = ${userId}
      GROUP BY status
      ORDER BY count DESC
    `;
        // 👆 Now using the named interface — much cleaner syntax: <TaskStatRow[]>


        // 👆 prisma.$queryRaw — lets us write ACTUAL SQL directly
        // 👆 The backtick template literal syntax (just like our earlier toast/fetch examples!)
        // 👆 ${userId} — Prisma SAFELY inserts this value, protecting against SQL injection
        //    (NEVER manually concatenate strings into raw SQL — always use this template syntax!)
        // 👆 "Task" with double quotes — PostgreSQL is case-sensitive for table names,
        //    and Prisma capitalizes model names, so we must quote it exactly
        // 👆 ROUND(...,1) — a native PostgreSQL function Prisma's query builder 
        //    doesn't have a built-in equivalent for

        // 👆 Added a TypeScript generic <{ status: string; count: bigint; percentage: number }[]>
        // This tells TypeScript exactly what shape to expect back from the raw query
        // (Prisma can't auto-infer types for raw SQL the way it does for normal queries)

        const serializedStats = stats.map((row) => ({
            status: row.status,
            count: Number(row.count),
            // 👆 Number(row.count) — explicitly converts BigInt → regular JS number
            // Safe here because task counts will NEVER realistically approach
            // the astronomical scale where BigInt's extra range actually matters
            percentage: row.percentage
        }));
        // 👆 We build a NEW plain array with converted values,
        // rather than trying to mutate the BigInt fields directly

        return NextResponse.json({
            success: true,
            data: serializedStats
        });

    } catch (error) {
        console.error("GET /api/tasks/stats error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch statistics" },
            { status: 500 }
        );
    }
}