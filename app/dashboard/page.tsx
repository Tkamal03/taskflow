"use client";
// 👆 Client Component — needed for useState, useEffect, onClick
import Toast from "@/app/components/Toast";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
// 👆 Client-side way to get session (Server way was auth() — different file, different rule!)
import { useRouter } from "next/navigation";
import TaskSkeleton from "@/app/components/TaskSkeleton";
import { TasksApiResponse, Task } from "@/lib/types";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    // 👆 status — "loading" | "authenticated" | "unauthenticated"

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [tasksLoading, setTasksLoading] = useState(false);
    // 👆 a SEPARATE state, specifically for "is the task list 
    // currently refreshing" (used for search/filter/pagination, 
    // NOT initial load)

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

    const [debouncedSearch, setDebouncedSearch] = useState("");
    // 👆 this is the value that ACTUALLY triggers the API call
    // It only updates AFTER the user pauses typing

    const [showAddForm, setShowAddForm] = useState(false);
    // ⭐ NEW — controls the INLINE collapsible add-task panel
    // (replaces the earlier full-screen modal idea — point 3 from your feedback)

    const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
    // ⭐ NEW — tracks WHICH task's custom status dropdown is currently open
    // We store the task ID (not just true/false) since only ONE dropdown
    // should be open at a time, across potentially many task rows

    const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
    // ⭐ NEW — holds the task awaiting delete confirmation
    // null = no confirmation showing. A Task object = show confirm dialog for THIS task

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    // ⭐ NEW — controls the user avatar dropdown (click-based, not hover-based)

    const statusOptions = ["Todo", "InProgress", "Done"];
    const statusLabels: Record<string, string> = { Todo: "Todo", InProgress: "In progress", Done: "Done" };
    // 👆 Record<string, string> — a typed dictionary mapping internal status
    // values to their nicer display labels (learned this pattern on Day 9!)

    async function fetchTasks(page: number = 1) {
        setTasksLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: "5",
            search: debouncedSearch,
            // 👆 send the current search box value to the backend
            status: filter
            // 👆 send the current filter selection to the backend
        });
        // 👆 URLSearchParams — a clean built-in way to build query strings
        // Handles encoding special characters safely (spaces, symbols, etc.)
        // Result: "page=1&limit=5&search=milk&status=Todo"

        const response = await fetch(`/api/tasks?${params.toString()}`);
        // 👆 Calls our GET handler — automatically scoped to logged-in user

        const result: TasksApiResponse = await response.json();
        // 👆 our actual API returns data AND pagination together

        if (result.success) {
            setTasks(result.data);
            setCurrentPage(result.pagination.currentPage);
            setTotalPages(result.pagination.totalPages);
            setTotalTasks(result.pagination.totalTasks);
        } else {
            // 👆 TypeScript NARROWS the other way — result.message exists here
            setToast({ message: result.message, type: "error" });
        }
        setLoading(false);
        setTasksLoading(false);
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            // 👆 After 1000ms of NO changes to searchQuery, finally "commit" the value
        }, 1000);

        return () => clearTimeout(timer);
        // 👆 CRITICAL — cancels the previous timer every time searchQuery changes
    }, [searchQuery]);

    useEffect(() => {
        fetchTasks(1);
        // 👆 Whenever searchQuery OR filter changes, go back to PAGE 1 and re-fetch
    }, [debouncedSearch, filter]);

    async function handleAddTask() {
        if (!newTask.title.trim()) {
            setToast({ message: "Task title cannot be empty", type: "error" });
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
            setToast({ message: "Task added successfully!", type: "success" });
            setShowAddForm(false);
            // ⭐ NEW — collapse the inline form after successfully adding
            fetchTasks();
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
            setToast({ message: `Task marked as ${statusLabels[newStatus]}`, type: "success" });
            fetchTasks();
        } else {
            setToast({ message: "Failed to update task", type: "error" });
        }
        setOpenStatusDropdown(null);
        // ⭐ NEW — close the dropdown after a selection is made
    }

    function confirmDeleteTask(task: Task) {
        setTaskPendingDelete(task);
        // ⭐ NEW — instead of deleting immediately, show the confirmation dialog first
    }

    async function handleDeleteConfirmed() {
        if (!taskPendingDelete) return;
        // 👆 Safety check — shouldn't happen, but keeps TypeScript happy
        // (taskPendingDelete could technically be null per its type)

        const response = await fetch(`/api/tasks/${taskPendingDelete.id}`, { method: "DELETE" });
        const data = await response.json();

        if (data.success) {
            setToast({ message: "Task deleted", type: "success" });
            fetchTasks();
        } else {
            setToast({ message: "Failed to delete task", type: "error" });
        }
        setTaskPendingDelete(null);
        // ⭐ NEW — close the confirmation dialog either way
    }

    async function handleLogout() {
        await signOut({ redirect: false });
        router.push("/login");
    }

    if (status === "loading" || loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-[#EEF4FC] via-[#E3EDFA] to-[#DCE9FA]">
                <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-8 py-4">
                    <div className="h-8 bg-white/60 rounded w-32 mb-2 animate-pulse"></div>
                    <div className="h-4 bg-white/50 rounded w-48 animate-pulse"></div>
                </div>
                <div className="max-w-[1040px] mx-auto p-7">
                    {/* 👆 CHANGED — widened from 720px to 880px (point 4 — less empty space) */}
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <TaskSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    const completedCount = tasks.filter(t => t.status === "Done").length;
    const completionPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const circumference = 2 * Math.PI * 36;
    const strokeOffset = circumference - (completionPercent / 100) * circumference;

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#EEF4FC] via-[#E3EDFA] to-[#DCE9FA]">

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-8 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* ⭐ UPDATED LOGO — interlocking flow loops, matches Kamal's reference image */}
                    <div className="w-8 h-8 rounded-[9px] bg-[#4C3D8F] flex items-center justify-center">
                        {/* 👆 Solid #4C3D8F — matches the active Filter button color exactly */}
                        {/* 👆 Grape → Coneflower — one shade darker than before */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M8 6C5.5 6 4 8 4 10.5C4 13 6 15 8.5 15C11 15 13 13 13 10.5"
                                stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                            <path d="M16 18C18.5 18 20 16 20 13.5C20 11 18 9 15.5 9C13 9 11 11 11 13.5"
                                stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                        </svg>
                    </div>
                    <span className="text-base font-semibold text-[#1E3A5F] font-display">TaskFlow</span>
                </div>

                {/* User menu — click-based (not hover) dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="w-9 h-9 rounded-full bg-[#4C3D8F] text-white flex items-center justify-center text-sm font-semibold cursor-pointer"
                        aria-label={`Open menu for ${session?.user?.name || "your account"}`}
                    >
                        {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                    </button>
                    {userMenuOpen && (
                        <>
                            {/* 👆 Invisible full-screen layer to detect "click outside" and close the menu */}
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setUserMenuOpen(false)}
                            />
                            <div className="absolute top-11 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-lg w-48 p-1.5 z-20">
                                <div className="px-3 py-2 text-xs text-[#64748B] flex items-center gap-2 truncate">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></svg>
                                    {session?.user?.email}
                                </div>
                                <div className="h-px bg-[#F1F5F9] my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                                    Log out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="max-w-[1040px] mx-auto p-7">
                {/* 👆 CHANGED — widened container (point 4) */}

                {/* Hero row — progress ring + greeting */}
                <div className="flex items-center gap-6 mb-7">
                    <div className="relative w-[84px] h-[84px] flex-shrink-0">
                        <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
                            <defs>
                                {/* ⭐ FINAL — 3-stop gradient using exact sampled colors from Kamal's 
         reference palette: Coneflower → Amethyst → app blue */}
                                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#A374C2" />
                                    {/* 👆 Grape — sampled from the same reference palette, one shade darker */}
                                    <stop offset="55%" stopColor="#B593CF" />
                                    {/* 👆 Coneflower — shifted into the middle position */}
                                    <stop offset="100%" stopColor="#3B6FE0" />
                                    {/* 👆 App's primary blue — unchanged */}
                                </linearGradient>
                            </defs>
                            <circle cx="42" cy="42" r="36" fill="none" stroke="#E0E7F7" strokeWidth="7" />
                            {/* 👆 CHANGED — light blue-gray track instead of light purple */}
                            <circle
                                cx="42" cy="42" r="36" fill="none" stroke="url(#ringGradient)" strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeOffset}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-base font-semibold text-[#1E3A5F]">
                            {/* 👆 CHANGED — dark blue (matches header logo text color) instead of dark purple */}
                            {completionPercent}%
                        </div>
                    </div>
                    <div>
                        <h1 className="text-[22px] font-semibold text-[#1E293B] mb-0.5 font-display">
                            Welcome, {session?.user?.name}!
                        </h1>
                        <p className="text-[13px] text-[#64748B]">
                            {completedCount} of {totalTasks} tasks done
                        </p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex gap-2.5 mb-4.5">
                    <div className="flex-1 flex items-center gap-2 bg-white/65 border border-[#DCE7F5] rounded-xl px-3.5">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <input
                            type="text"
                            placeholder="Search tasks by title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm px-4.5 rounded-xl flex items-center gap-1.5 shadow-[0_8px_20px_rgba(76,61,143,0.4)] transition-colors whitespace-nowrap"
                    // 👆 #4C3D8F base, manually darkened hover state, shadow color updated to match
                    >
                        <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                            className={`transition-transform ${showAddForm ? "rotate-45" : ""}`}
                        // 👆 NICE TOUCH — the + icon rotates into an × shape when form is open,
                        // visually communicating "click again to close"
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        {showAddForm ? "Close" : "Add task"}
                    </button>
                </div>

                {/* ⭐ NEW — Inline collapsible Add Task form (point 3) */}
                {showAddForm && (
                    <div className="bg-gradient-to-br from-[#DCE4FA] to-[#C5D2F2] border border-white/60 rounded-2xl p-3.5 mb-4.5 animate-[slideDown_0.25s_ease-out]">
                        {/* 👆 NEW — outer layer is now a darker two-tone gradient (point: "form background darker") */}
                        <div className="bg-white/55 backdrop-blur-md rounded-[14px] p-4">
                            {/* 👆 NEW — inner frosted panel holds the actual fields, 
             creating the same "card within a card" depth as the delete dialog */}
                            <div className="flex flex-col gap-2.5">
                                <input
                                    type="text"
                                    placeholder="Task title"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    className="bg-white border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#3B6FE0]"
                                />
                                <input
                                    type="text"
                                    placeholder="Description (optional)"
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    className="bg-white border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#3B6FE0]"
                                />
                                <div className="flex gap-2">
                                    {["Low", "Medium", "High"].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setNewTask({ ...newTask, priority: p })}
                                            className={`flex-1 text-center py-2 rounded-lg text-[13px] font-medium border transition-colors ${newTask.priority === p
                                                ? p === "Low" ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                                    : p === "Medium" ? "bg-amber-50 border-amber-300 text-amber-700"
                                                        : "bg-rose-50 border-rose-300 text-rose-700"
                                                : "bg-white border-[#DCE7F5] text-[#64748B]"
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleAddTask}
                                    className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm py-2.5 rounded-xl shadow-[0_8px_20px_rgba(76,61,143,0.4)] transition-colors mt-1"
                                >
                                    Add task
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Buttons — point 7 — purple active state */}
                <div className="flex gap-2 mb-4.5">
                    {["All", "Todo", "InProgress", "Done"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === f
                                ? "bg-[#4C3D8F] text-white"
                                : "bg-white/60 text-[#475569] border border-[#DCE7F5]"
                                }`}
                        >
                            {f === "InProgress" ? "In progress" : f}
                        </button>
                    ))}
                </div>

                {/* Task List */}
                {tasksLoading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <TaskSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/55 backdrop-blur-md border border-white/70 rounded-2xl px-4">
                        {tasks.length === 0 && (
                            <p className="text-center text-[#94A3B8] py-10">No tasks found</p>
                        )}
                        {tasks.map((task, index) => (
                            <div
                                key={task.id}
                                className={`flex items-center gap-3.5 py-4 ${index !== tasks.length - 1 ? "border-b border-[#E2E8F0]/70" : ""
                                    }`}
                            >
                                <button
                                    onClick={() => handleStatusChange(task.id, task.status === "Done" ? "Todo" : "Done")}
                                    className={`w-5 h-5 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${task.status === "Done" ? "bg-[#4C3D8F] border-[#4C3D8F]" : "border-[#CBD5E1] bg-white"
                                        }`}
                                >
                                    {task.status === "Done" && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                                    )}
                                </button>

                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${task.status === "Done" ? "text-[#94A3B8] line-through" : "text-[#1E293B]"}`}>
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${task.priority === "High" ? "bg-rose-500" :
                                            task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                                            }`}></span>
                                        {task.description && (
                                            <span className="text-xs text-[#94A3B8]">{task.description}</span>
                                        )}
                                    </div>
                                </div>

                                {/* ⭐ NEW — Custom status dropdown (point 1), replaces native <select> */}
                                <div className="relative">
                                    <button
                                        onClick={() => setOpenStatusDropdown(openStatusDropdown === task.id ? null : task.id)}
                                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${task.status === "Todo" ? "bg-white border-[#DCE7F5] text-[#64748B]" :
                                            task.status === "InProgress" ? "bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]" :
                                                "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
                                            }`}
                                    >
                                        {statusLabels[task.status]}
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                    </button>

                                    {openStatusDropdown === task.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setOpenStatusDropdown(null)}
                                            />
                                            <div className="absolute top-9 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-lg w-32 p-1 z-20">
                                                {statusOptions.map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleStatusChange(task.id, s)}
                                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg ${task.status === s ? "bg-[#EEF2FF] text-[#4338CA] font-medium" : "text-[#475569] hover:bg-[#F8FAFC]"
                                                            }`}
                                                    >
                                                        {statusLabels[s]}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* ⭐ NEW — darker, more visible delete icon (point 2) */}
                                <button
                                    onClick={() => confirmDeleteTask(task)}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-6">
                        <button
                            onClick={() => fetchTasks(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-white/70 border border-[#DCE7F5] rounded-lg font-medium text-sm text-[#475569] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                        >
                            ← Previous
                        </button>
                        <span className="text-[#64748B] text-sm font-medium">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => fetchTasks(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 bg-white/70 border border-[#DCE7F5] rounded-lg font-medium text-sm text-[#475569] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}

                <p className="text-center text-[#94A3B8] text-xs mt-3">
                    {totalTasks} total task{totalTasks !== 1 ? "s" : ""}
                </p>
            </div>

            {/* ⭐ FIXED — Delete confirmation dialog with translucent backdrop,
       click-outside-to-close, explicit X button, and smaller action buttons */}
            {taskPendingDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1E2947]/45 backdrop-blur-[3px]"
                    onClick={() => setTaskPendingDelete(null)}
                // ⭐ NEW — clicking anywhere on this dark backdrop closes the dialog
                // This works because the backdrop and the card are SEPARATE elements —
                // clicking the backdrop itself (not the card) triggers this onClick
                >
                    <div
                        className="w-full max-w-[340px] bg-white/92 backdrop-blur-xl border border-white/60 rounded-[18px] p-6 shadow-2xl text-center relative"
                        onClick={(e) => e.stopPropagation()}
                    // ⭐ NEW — CRITICAL — stops the click from "bubbling up" to the backdrop's
                    // onClick above. Without this, clicking ANYWHERE inside the card
                    // (including the Cancel/Delete buttons) would ALSO trigger the
                    // backdrop's close handler — e.stopPropagation() prevents that bubbling
                    >
                        {/* ⭐ NEW — explicit X close button, top-right of the card */}
                        <button
                            onClick={() => setTaskPendingDelete(null)}
                            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] flex items-center justify-center text-[#64748B] transition-colors"
                            aria-label="Close dialog"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>

                        <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                        </div>
                        <p className="text-[15px] font-semibold text-[#1E293B] mb-1.5">Delete this task?</p>
                        <p className="text-[13px] text-[#64748B] mb-4">
                            &ldquo;{taskPendingDelete.title}&rdquo; will be permanently removed. This can&apos;t be undone.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTaskPendingDelete(null)}
                                className="flex-1 bg-white border border-[#E2E8F0] text-[#475569] font-medium text-xs py-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                            // 👆 CHANGED — text-[13px]→text-xs, py-2.5→py-2 (smaller button, point requested)
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirmed}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs py-2 rounded-lg transition-colors"
                            // 👆 SAME size reduction applied here for consistency
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}