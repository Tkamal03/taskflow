import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// POST — attach a tag to a task
export async function POST(
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

        const { id: taskId } = await params;
        const { tagId } = await request.json();

        // Verify task belongs to this user (same security pattern as before!)
        const task = await prisma.task.findUnique({ where: { id: taskId } });

        if (!task || task.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Task not found or not authorized" },
                { status: 403 }
            );
        }

        const taskTag = await prisma.taskTag.create({
            data: { taskId, tagId }
            // 👆 This is THE key moment — we're not creating a Task or a Tag,
            // we're creating the CONNECTION between an existing task and existing tag
        });

        return NextResponse.json(
            { success: true, data: taskTag },
            { status: 201 }
        );

    } catch (error: any) {
        if (error.code === "P2002") {
            // 👆 Fires if this exact taskId+tagId combo already exists
            // (remember our @@id([taskId, tagId]) composite key!)
            return NextResponse.json(
                { success: false, message: "This tag is already on this task" },
                { status: 409 }
            );
        }

        console.error("POST tag-to-task error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to add tag" },
            { status: 500 }
        );
    }
}

// DELETE — remove a tag from a task
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

        const { id: taskId } = await params;
        const { tagId } = await request.json();

        const task = await prisma.task.findUnique({ where: { id: taskId } });

        if (!task || task.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, message: "Task not found or not authorized" },
                { status: 403 }
            );
        }

        await prisma.taskTag.delete({
            where: {
                taskId_tagId: { taskId, tagId }
                // 👆 Special syntax for composite keys!
                // Since our @@id is [taskId, tagId] combined, Prisma generates
                // this specific "taskId_tagId" field name to let us look up
                // by BOTH parts of the composite key together
            }
        });

        return NextResponse.json({
            success: true,
            message: "Tag removed from task"
        });

    } catch (error) {
        console.error("DELETE tag-from-task error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to remove tag" },
            { status: 500 }
        );
    }
}