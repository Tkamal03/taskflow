import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
// 👆 Our single Prisma instance
import { Prisma as PrismaTypes } from "@prisma/client";
// 👆 RENAMED — using "as" to avoid confusion with our lowercase 
import { auth } from "@/auth";
// 👆 auth() — gets current session in Server-side code (API routes are server-side!)

// GET — fetch all tasks belonging to logged-in user
export async function GET(request: Request) {
    try {
        const session = await auth();
        // 👆 Get current logged in user's session

        if (!session?.user?.id) {
            // 👆 ?. optional chaining — safely checks nested properties
            // If no session OR no user OR no id — this is true
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
                // 👆 401 — Unauthorized, no valid session
            );
        }

        /*Pagination start */

        const { searchParams } = new URL(request.url);
        // 👆 URL — built-in Node.js class to parse a URL string
        // searchParams — gives us access to query parameters like ?page=2&limit=10

        const page = parseInt(searchParams.get("page") || "1");
        // 👆 searchParams.get("page") returns a STRING or null
        // parseInt converts it to a number
        // || "1" — if no page param sent, default to page 1

        const limit = parseInt(searchParams.get("limit") || "5");
        // 👆 How many tasks per page — defaulting to 5 for easy testing
        // (in a real app this might be 10, 20, or 50)

        const skip = (page - 1) * limit;
        // 👆 The core pagination math!
        // Page 1 → skip (1-1)*5 = 0   → tasks 1-5
        // Page 2 → skip (2-1)*5 = 5   → tasks 6-10
        // Page 3 → skip (3-1)*5 = 10  → tasks 11-15


        // Searech from DB start here....

        const search = searchParams.get("search") || "";
        // 👆 NEW — read the search term from the URL query params
        // Defaults to empty string if no search term provided


        const statusFilter = searchParams.get("status") || "All";
        // 👆 NEW — also move status filtering to the backend, same logic!
        // (Day 6's status filter buttons had the SAME problem as search,
        //  just less obvious — let's fix both together)

        // ⭐ Build the WHERE clause dynamically based on what's provided
        const whereClause: PrismaTypes.TaskWhereInput = {
            // 👆 Using our renamed "PrismaTypes" instead of "Prisma"
            // 👆 CHANGED from "any" to "Prisma.TaskWhereInput"
            // This is a type PRISMA ITSELF GENERATES based on your schema —
            // it knows EXACTLY what fields/filters are valid for the Task model
            userId: session.user.id
            // 👆 Security check stays exactly the same — always scoped to user
        };

        if (search) {
            whereClause.title = {
                contains: search,
                // 👆 Prisma's "contains" — translates to SQL's LIKE '%search%'
                mode: "insensitive"
                // 👆 "insensitive" — makes the search case-insensitive at the DATABASE level
                // (remember our .toLowerCase() trick from Day 6? Prisma has a built-in way!)
            };
        }

        if (statusFilter !== "All") {
            whereClause.status = statusFilter;
            // 👆 Only add this filter if a SPECIFIC status was requested
        }

        const totalTasks = await prisma.task.count({
            where: whereClause
            // 👆 Now count() respects search+filter too, not just userId!
            // This is THE key fix — totalPages will now be calculated 
            // based on MATCHING tasks, not ALL tasks
        });

        const tasks = await prisma.task.findMany({
            where: whereClause,
            orderBy: {
                createdAt: "desc"
                // 👆 desc — newest tasks first
            },
            skip: skip,
            // 👆 Tells the database to SKIP this many rows before starting
            take: limit,
            // 👆 Tells the database to TAKE only this many rows after skipping
            // Together, skip+take = the database does the heavy lifting,
            // NOT our JavaScript code — much more efficient at scale!
            include: {
                tags: {
                    // 👆 include — tells Prisma "also fetch the related TaskTag records"
                    include: {
                        tag: true
                        // 👆 NESTED include — for each TaskTag, ALSO fetch the actual Tag details
                        // Without this, you'd only get { taskId, tagId } — not the tag's name/color!
                    }
                }
            }
        });

        const totalPages = Math.ceil(totalTasks / limit);
        // 👆 Math.ceil — rounds UP
        // 23 total tasks ÷ 5 per page = 4.6 → rounds up to 5 pages
        // (that last page would have only 3 tasks, but it still needs to exist)

        return NextResponse.json({
            success: true,
            count: tasks.length,
            data: tasks,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalTasks: totalTasks,
                hasNextPage: page < totalPages,
                // 👆 true if there are more pages after this one
                hasPrevPage: page > 1
                // 👆 true if we're not already on page 1
            }
        });
    } catch (error) {
        console.error("GET /api/tasks error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch tasks" },
            { status: 500 }
        );
    }
}

// POST — create a new task for logged-in user
export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const body = await request.json();
        // 👆 Get task data sent from frontend

        if (!body.title) {
            // 👆 Title is the only required field — description/status/priority have defaults
            return NextResponse.json(
                { success: false, message: "Title is required" },
                { status: 400 }
            );
        }

        const newTask = await prisma.task.create({
            data: {
                title: body.title,
                description: body.description || null,
                // 👆 If no description sent, store null (it's optional in schema)
                status: body.status || "Todo",
                priority: body.priority || "Medium",
                userId: session.user.id
                // ⭐ CRITICAL — links this task to the logged-in user
                // This is the foreign key from our schema!
            }
        });

        return NextResponse.json(
            { success: true, data: newTask },
            { status: 201 }
            // 👆 201 — Created successfully
        );
    } catch (error) {
        console.error("POST /api/tasks error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to create task" },
            { status: 500 }
        );
    }
}