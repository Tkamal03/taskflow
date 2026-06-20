"use client";
// 👆 Client Component — needed for useState, useEffect, onClick
import Toast from "@/app/components/Toast";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
// 👆 Client-side way to get session (Server way was auth() — different file, different rule!)
import { useRouter } from "next/navigation";
import TaskSkeleton from "@/app/components/TaskSkeleton";

interface Task {
    // 👆 TypeScript interface — defines the shape of a Task object
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    createdAt: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    // 👆 status — "loading" | "authenticated" | "unauthenticated"

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTask, setNewTask] = useState({ title: "", description: "", priority: "Medium" });
    const [filter, setFilter] = useState("All");
    // 👆 filter — controls which tasks are shown (All/Todo/InProgress/Done)

    const [searchQuery, setSearchQuery] = useState("");
    // 👆 Holds whatever the user types in the search box

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    // 👆 null when no toast is showing
    // Object with message+type when a toast SHOULD show
    // This single state controls the entire toast lifecycle

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTasks, setTotalTasks] = useState(0);
    //For pagination state 

    async function fetchTasks(page: number = 1) {
        const response = await fetch(`/api/tasks?page=${page}&limit=5`);
        // 👆 Calls our GET handler — automatically scoped to logged-in user
        // 👆 Building the URL with query parameters
        // Template literal makes this readable: /api/tasks?page=2&limit=5
        const data = await response.json();
        if (data.success) {
            setTasks(data.data);
            setCurrentPage(data.pagination.currentPage);
            setTotalPages(data.pagination.totalPages);
            setTotalTasks(data.pagination.totalTasks);
        }
        setLoading(false);
    }

    useEffect(() => {
        fetchTasks(1);
    }, []);
    // 👆 Empty array = run once when page loads

    async function handleAddTask() {
        if (!newTask.title.trim()) {

            setToast({ message: "Task title cannot be empty", type: "error" });
            // 👆 Show error toast instead of silently returning
            return;
        }
        // 👆 .trim() removes whitespace — prevents adding blank-looking tasks

        const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTask)
        });

        const data = await response.json();
        if (data.success) {
            setNewTask({ title: "", description: "", priority: "Medium" });
            // 👆 Clear form after successful add
            setToast({ message: "Task added successfully!", type: "success" });
            // 👆 Confirms the action worked — clear positive feedback
            fetchTasks();
            // 👆 Refresh list to show new task
        } else {
            setToast({ message: data.message || "Failed to add task", type: "error" });
        }
    }

    async function handleStatusChange(taskId: string, newStatus: string) {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
            // 👆 Only sending status — PUT handler keeps other fields unchanged (?? logic)
        });

        const data = await response.json();

        if (data.success) {
            setToast({ message: `Task marked as ${newStatus}`, type: "success" });
            fetchTasks();
        } else {
            setToast({ message: "Failed to update task", type: "error" });
        }
    }

    async function handleDeleteTask(taskId: string) {
        const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        const data = await response.json();

        if (data.success) {
            setToast({ message: "Task deleted", type: "success" });
            fetchTasks();
        } else {
            setToast({ message: "Failed to delete task", type: "error" });
        }
    }

    async function handleLogout() {
        await signOut({ redirect: false });
        router.push("/login");
    }

    const filteredTasks = tasks
        .filter(task => filter === "All" || task.status === filter)
        // 👆 Step 1 — apply status filter (All/Todo/InProgress/Done) — same as before

        .filter(task =>
            task.title.toLowerCase().includes(searchQuery.toLowerCase())
            // 👆 Step 2 — apply search filter on TOP of the status filter
            // .toLowerCase() on both sides — makes search case-insensitive
            // "Buy Milk" matches search "milk" or "MILK" or "Milk"
        );
    // 👆 Chaining .filter() twice — narrows down step by step
    // First by status, then by search text — both apply together!

    if (status === "loading" || loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="bg-white shadow-sm px-8 py-4">
                    <div className="h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                    {/* 👆 Mimics the "TaskFlow" header while loading */}
                    <div className="h-4 bg-gray-100 rounded w-48 animate-pulse"></div>
                    {/* 👆 Mimics the welcome message */}
                </div>
                <div className="max-w-3xl mx-auto p-8">
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <TaskSkeleton key={i} />
                            // 👆 Show 3 skeleton placeholders while real tasks load
                            // Gives the user an idea of "3 tasks worth of space" coming
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">

            {/* ⭐ NEW — Toast renders conditionally */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                // 👆 When toast closes (auto or manual), reset state back to null
                />
            )}

            {/* Header */}
            <div className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-blue-700">TaskFlow 📋</h1>
                    <p className="text-gray-500 text-sm">Welcome, {session?.user?.name}!</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="bg-gray-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
                >
                    Logout 🚪
                </button>
            </div>

            <div className="max-w-3xl mx-auto p-8">

                {/* Add Task Form */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">➕ Add New Task</h2>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="Task title"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            // 👆 Spread operator — copies existing newTask, updates only title
                            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="Description (optional)"
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <select
                            value={newTask.priority}
                            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        >
                            <option value="Low">Low Priority</option>
                            <option value="Medium">Medium Priority</option>
                            <option value="High">High Priority</option>
                        </select>
                        <button
                            onClick={handleAddTask}
                            className="bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700"
                        >
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="🔍 Search tasks by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        // 👆 Updates searchQuery on every keystroke
                        // filteredTasks automatically recalculates — no extra function needed!
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2 mb-4">
                    {["All", "Todo", "InProgress", "Done"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm ${filter === f
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-600 border border-gray-300"
                                }`}
                        // 👆 Conditional className — highlights active filter
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Task List */}
                <div className="flex flex-col gap-3">
                    {filteredTasks.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No tasks found</p>
                    )}
                    {filteredTasks.map((task) => (
                        <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800">{task.title}</h3>
                                    {task.description && (
                                        <p className="text-gray-500 text-sm mt-1">{task.description}</p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <span className={`text-xs px-2 py-1 rounded-full ${task.priority === "High" ? "bg-red-100 text-red-700" :
                                            task.priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                                                "bg-green-100 text-green-700"
                                            }`}>
                                            {task.priority}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-red-500 hover:text-red-700 ml-4"
                                >
                                    🗑
                                </button>
                            </div>
                            <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                className="mt-3 border border-gray-300 rounded-lg px-3 py-1 text-sm"
                            >
                                <option value="Todo">Todo</option>
                                <option value="InProgress">In Progress</option>
                                <option value="Done">Done</option>
                            </select>
                        </div>
                    ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    // 👆 Only show pagination UI if there's more than 1 page
                    // No point showing "Page 1 of 1" with disabled buttons
                    <div className="flex justify-center items-center gap-4 mt-6">
                        <button
                            onClick={() => fetchTasks(currentPage - 1)}
                            disabled={currentPage === 1}
                            // 👆 Can't go below page 1
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            ← Previous
                        </button>

                        <span className="text-gray-600 text-sm font-medium">
                            Page {currentPage} of {totalPages}
                            {/* 👆 Shows current position — clear feedback to the user */}
                        </span>

                        <button
                            onClick={() => fetchTasks(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            // 👆 Can't go beyond the last page
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Next →
                        </button>
                    </div>
                )}

                <p className="text-center text-gray-400 text-xs mt-3">
                    {totalTasks} total task{totalTasks !== 1 ? "s" : ""}
                    {/* 👆 Conditional "s" — grammar detail! "1 task" vs "5 tasks" */}
                </p>

            </div>
        </main>
    );
}