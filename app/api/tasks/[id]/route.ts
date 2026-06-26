import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { TaskUpdateInput } from "@/lib/types";

// GET — fetch one specific task
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
    // 👆 Promise — Next.js 15/16 way of typing dynamic params
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { id } = await params;
        // 👆 Unwrap the Promise to get actual task id from URL

        const task = await prisma.task.findUnique({
            where: { id }
        });

        if (!task) {
            return NextResponse.json(
                { success: false, message: "Task not found" },
                { status: 404 }
            );
        }

        if (task.userId !== session.user.id) {
            // ⭐ CRITICAL SECURITY CHECK
            // Even though we found the task, we verify it BELONGS to this user
            // Without this — User A could view User B's task by guessing the id!
            return NextResponse.json(
                { success: false, message: "Not authorized to view this task" },
                { status: 403 }
                // 👆 403 — Forbidden (authenticated, but not allowed)
            );
        }

        return NextResponse.json({ success: true, data: task });
    } catch (error) {
        console.error("GET /api/tasks/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch task" },
            { status: 500 }
        );
    }
}

// PUT — update a task
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { id } = await params;
        // const body = await request.json();

        const body: TaskUpdateInput = await request.json();
        // 👆 THIS is where TaskUpdateInput actually gets used
        // body.title, body.status, body.priority — ALL optional now
        // TypeScript allows you to send JUST { status: "Done" } 
        // without complaining that title/description are "missing"

        // First check task exists AND belongs to user
        const existingTask = await prisma.task.findUnique({ where: { id } });

        if (!existingTask) {
            return NextResponse.json(
                { success: false, message: "Task not found" },
                { status: 404 }
            );
        }

        if (existingTask.userId !== session.user.id) {
            // ⭐ Same security check — never trust the id alone!
            return NextResponse.json(
                { success: false, message: "Not authorized to update this task" },
                { status: 403 }
            );
        }

        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                title: body.title ?? existingTask.title,
                // 👆 ?? nullish coalescing — if body.title is undefined, keep old value
                // Lets frontend send ONLY the fields that changed!
                description: body.description ?? existingTask.description,
                status: body.status ?? existingTask.status,
                priority: body.priority ?? existingTask.priority,
            }
        });

        return NextResponse.json({ success: true, data: updatedTask });
    } catch (error) {
        console.error("PUT /api/tasks/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update task" },
            { status: 500 }
        );
    }
}

// DELETE — remove a task
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const { id } = await params;

        const existingTask = await prisma.task.findUnique({ where: { id } });

        if (!existingTask) {
            return NextResponse.json(
                { success: false, message: "Task not found" },
                { status: 404 }
            );
        }

        if (existingTask.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Not authorized to delete this task" },
                { status: 403 }
            );
        }

        await prisma.task.delete({ where: { id } });

        return NextResponse.json({
            success: true,
            message: "Task deleted successfully"
        });
    } catch (error) {
        console.error("DELETE /api/tasks/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete task" },
            { status: 500 }
        );
    }
}