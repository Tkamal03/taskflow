"use client";
// 👆 Client Component — needed for useState, useEffect, onClick
import Toast from "@/app/components/Toast";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
// 👆 Client-side way to get session (Server way was auth() — different file, different rule!)
import { useRouter } from "next/navigation";
import TaskSkeleton from "@/app/components/TaskSkeleton";
import { TasksApiResponse, Task } from "@/lib/types";
import { useAiChat } from "@/app/components/AiChat/useAiChat";
import TaskList from "@/app/components/Dashboard/TaskList";
import AddTaskForm from "@/app/components/Dashboard/AddTaskForm";
import AiPanel from "@/app/components/Dashboard/AiPanel";
import Pagination from "@/app/components/Dashboard/Pagination";
import DashboardHeader from "@/app/components/Dashboard/DashboardHeader";

const statusLabels: Record<string, string> = {
    Todo: "Todo",
    InProgress: "In progress",
    Done: "Done"
};
// 👆 Record<string, string> — a typed dictionary mapping internal status

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

    const [improvingTaskId, setImprovingTaskId] = useState<string | null>(null);
    // ⭐ NEW — tracks WHICH task is currently being improved by AI
    // null = no improvement in progress
    // string (task ID) = that specific task is being processed

    const [improvedDescriptions, setImprovedDescriptions] = useState<Record<string, string>>({});
    // ⭐ NEW — stores AI-improved descriptions keyed by task ID
    // Record<string, string> = a typed dictionary { taskId: improvedText }
    // Example: { "cmq123": "Identify and fix the login bug..." }
    // We store ALL improvements so user can review before accepting

    const [prioritySuggesting, setPrioritySuggesting] = useState(false);
    // ⭐ NEW — tracks loading state specifically for the priority suggestion
    // Separate from the main `loading` state so it doesn't affect
    // the rest of the dashboard while AI is suggesting a priority

    const [priorityReason, setPriorityReason] = useState("");
    // ⭐ NEW — stores the AI's reason for the suggested priority
    // Shows briefly below the priority chips so user understands WHY

    const [showAiPanel, setShowAiPanel] = useState(false);
    // 👆 Keep this one — controls panel visibility, not AI logic

    const {
        messages: aiPanelMessages,
        prompt: aiPanelPrompt,
        setPrompt: setAiPanelPrompt,
        loading: aiPanelLoading,
        scrollContainerRef: aiPanelScrollRef,
        sendMessage: sendAiMessage,
        clearMessages: clearAiMessages,
    } = useAiChat();
    // ⭐ All AI state + logic now comes from the shared hook
    // Clean, zero duplication with ai-chat page

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
    // 👆 Runs every time searchQuery changes (every keystroke)

    useEffect(() => {
        fetchTasks(1);
        // 👆 Whenever searchQuery OR filter changes, go back to PAGE 1 and re-fetch
    }, [debouncedSearch, filter]);

    useEffect(() => {
        // ⭐ fix scroll the panel every time messages change OR loading changes
        // This catches BOTH cases:
        // - When user message appears (messages change)
        // - When loading bubble appears/disappears (loading changes)
        // - When AI reply appears (messages change again)
        if (aiPanelScrollRef.current) {
            aiPanelScrollRef.current.scrollTo({
                top: aiPanelScrollRef.current.scrollHeight,
                behavior: "smooth"
            });
        }
    }, [aiPanelMessages, aiPanelLoading]);
    // 👆 Watches BOTH — covers every state change in the conversation

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

    async function handleImproveDescription(task: Task) {
        // ⭐ NEW — calls the AI to improve a specific task's description
        setImprovingTaskId(task.id);
        // 👆 Show the improvement UI for THIS specific task
        // Clears any previous improved description for this task

        setImprovedDescriptions(prev => {
            const updated = { ...prev };
            delete updated[task.id];
            return updated;
            // 👆 Remove any existing improvement for this task
            // so the loading spinner shows while we fetch a fresh one
        });

        try {
            const response = await fetch("/api/ai/improve-task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: task.title,
                    description: task.description
                    // 👆 Sending BOTH title and description to the AI
                    // Title gives context, description is what gets improved
                })
            });

            const data = await response.json();

            if (data.success) {
                setImprovedDescriptions(prev => ({
                    ...prev,
                    [task.id]: data.improvedDescription
                    // 👆 Store the improved text keyed by task ID
                    // Spread existing improvements + add/update this task's
                }));
            } else {
                setToast({ message: data.message || "Failed to improve description", type: "error" });
                setImprovingTaskId(null);
                // 👆 Hide the improvement panel if there was an error
            }
        } catch (error) {
            setToast({ message: "Failed to connect to AI", type: "error" });
            setImprovingTaskId(null);
        }
    }

    async function handleAcceptImprovement(taskId: string, newDescription: string) {
        // ⭐ NEW — user clicked "Accept" — saves the AI description to the database
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: newDescription })
            // 👆 Reusing our EXISTING PUT endpoint from Week 2!
            // We just update the description field, everything else stays the same
            // This is why building a proper API layer matters — we can reuse it!
        });

        const data = await response.json();

        if (data.success) {
            setToast({ message: "✨ Task description improved!", type: "success" });
            setImprovingTaskId(null);
            // 👆 Hide the improvement panel
            setImprovedDescriptions(prev => {
                const updated = { ...prev };
                delete updated[taskId];
                return updated;
                // 👆 Clean up the stored improvement — no longer needed
            });
            fetchTasks(currentPage);
            // 👆 Refresh the task list to show the updated description
        } else {
            setToast({ message: "Failed to save improvement", type: "error" });
        }
    }

    function handleDismissImprovement(taskId: string) {
        // ⭐ NEW — user clicked "Dismiss" — discard the AI suggestion, keep original
        setImprovingTaskId(null);
        // 👆 Hide the improvement panel
        setImprovedDescriptions(prev => {
            const updated = { ...prev };
            delete updated[taskId];
            return updated;
            // 👆 Clean up the stored improvement
        });
    }

    async function handleSuggestPriority() {
        // ⭐ NEW — calls the AI to suggest a priority for the current task
        if (!newTask.title.trim()) {
            setToast({ message: "Please enter a task title first", type: "error" });
            return;
            // 👆 Can't suggest priority without a title — show helpful message
        }

        setPrioritySuggesting(true);
        // 👆 Show loading state on the suggest button
        setPriorityReason("");
        // 👆 Clear any previous reason before new suggestion

        try {
            const response = await fetch("/api/ai/suggest-priority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description
                    // 👆 Sending whatever the user has typed so far
                    // Works even if description is empty — title alone is enough
                })
            });

            const data = await response.json();

            if (data.success) {
                setNewTask({ ...newTask, priority: data.priority });
                // 👆 Automatically SET the priority chip to AI's suggestion
                // ...newTask spreads existing values, only priority changes
                setPriorityReason(data.reason);
                // 👆 Store the reason to show the user WHY this priority was chosen
            } else {
                setToast({ message: data.message || "Failed to suggest priority", type: "error" });
            }
        } catch (error) {
            setToast({ message: "Failed to connect to AI", type: "error" });
        } finally {
            setPrioritySuggesting(false);
            // 👆 Always turn off loading state — success or error
        }
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
            <DashboardHeader
                userName={session?.user?.name}
                userEmail={session?.user?.email}
                onLogout={handleLogout}
                userMenuOpen={userMenuOpen}
                setUserMenuOpen={setUserMenuOpen}
            />

            <div className="max-w-[1040px] mx-auto p-7">
                {/* progress ring + Welcome greeting */}
                <div className="flex items-center gap-6 mb-7">
                    <div className="relative w-[84px] h-[84px] flex-shrink-0">
                        <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
                            <defs>
                                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#A374C2" />
                                    <stop offset="55%" stopColor="#B593CF" />
                                    <stop offset="100%" stopColor="#3B6FE0" />
                                </linearGradient>
                            </defs>
                            <circle cx="42" cy="42" r="36" fill="none" stroke="#E0E7F7" strokeWidth="7" />
                            <circle
                                cx="42" cy="42" r="36" fill="none" stroke="url(#ringGradient)" strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeOffset}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-base font-semibold text-[#1E3A5F]">
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search tasks by title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none"
                        />
                        {/* ⭐ NEW — AI icon button inside search box right side */}
                        <button
                            onClick={() => setShowAiPanel(prev => !prev)}
                            // 👆 Toggle only — history preserved via useAiChat hook
                            className="flex-shrink-0 hover:opacity-75 transition-opacity"
                            aria-label="Ask AI about your tasks"
                            title="Ask AI"
                        >
                            <img
                                src="/ai-chat-icon.png"
                                alt="Ask AI"
                                className="w-6 h-6 object-contain"
                            />
                        </button>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm px-4.5 rounded-xl flex items-center gap-1.5 shadow-[0_8px_20px_rgba(76,61,143,0.4)] transition-colors whitespace-nowrap"
                    >
                        <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                            className={`transition-transform ${showAddForm ? "rotate-45" : ""}`}
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        {showAddForm ? "Close" : "Add task"}
                    </button>
                </div>
                {/* ⭐ Inline AI panel — uses shared AiChat components */}
                {showAiPanel && (
                    <AiPanel
                        messages={aiPanelMessages}
                        prompt={aiPanelPrompt}
                        loading={aiPanelLoading}
                        scrollContainerRef={aiPanelScrollRef}
                        onPromptChange={setAiPanelPrompt}
                        onSend={() => sendAiMessage()}
                        onSendChip={sendAiMessage}
                        onClear={clearAiMessages}
                        onClose={() => setShowAiPanel(false)}
                        onExpand={() => {
                            if (aiPanelMessages.length > 0) {
                                sessionStorage.setItem("aiChatHistory", JSON.stringify(aiPanelMessages));
                            }
                            window.location.href = "/ai-chat";
                        }}
                    />
                )}

                {/* ⭐ NEW — Inline collapsible Add Task form (point 3) */}
                {/* Add Task form */}
                {showAddForm && (
                    <AddTaskForm
                        newTask={newTask}
                        onNewTaskChange={setNewTask}
                        onAddTask={handleAddTask}
                        prioritySuggesting={prioritySuggesting}
                        priorityReason={priorityReason}
                        onSuggestPriority={handleSuggestPriority}
                        onPriorityManualSelect={(p) => {
                            setNewTask({ ...newTask, priority: p });
                            setPriorityReason("");
                        }}
                    />
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
                <TaskList
                    tasks={tasks}
                    tasksLoading={tasksLoading}
                    totalTasks={totalTasks}
                    openStatusDropdown={openStatusDropdown}
                    setOpenStatusDropdown={setOpenStatusDropdown}
                    improvingTaskId={improvingTaskId}
                    improvedDescriptions={improvedDescriptions}
                    onStatusChange={handleStatusChange}
                    onImproveDescription={handleImproveDescription}
                    onAcceptImprovement={handleAcceptImprovement}
                    onDismissImprovement={handleDismissImprovement}
                    onConfirmDelete={confirmDeleteTask}
                />

                {/* Pagination Controls */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalTasks={totalTasks}
                    onPageChange={fetchTasks}
                />
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
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirmed}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs py-2 rounded-lg transition-colors"
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