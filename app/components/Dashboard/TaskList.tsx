"use client";

import TaskSkeleton from "@/app/components/TaskSkeleton";
import { Task } from "@/lib/types";

interface TaskListProps {
    tasks: Task[];
    tasksLoading: boolean;
    totalTasks: number;
    openStatusDropdown: string | null;
    setOpenStatusDropdown: (id: string | null) => void;
    improvingTaskId: string | null;
    improvedDescriptions: Record<string, string>;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onImproveDescription: (task: Task) => void;
    onAcceptImprovement: (taskId: string, newDescription: string) => void;
    onDismissImprovement: (taskId: string) => void;
    onConfirmDelete: (task: Task) => void;
}

const statusOptions = ["Todo", "InProgress", "Done"];
const statusLabels: Record<string, string> = {
    Todo: "Todo",
    InProgress: "In progress",
    Done: "Done",
};

export default function TaskList({
    tasks,
    tasksLoading,
    totalTasks,
    openStatusDropdown,
    setOpenStatusDropdown,
    improvingTaskId,
    improvedDescriptions,
    onStatusChange,
    onImproveDescription,
    onAcceptImprovement,
    onDismissImprovement,
    onConfirmDelete,
}: TaskListProps) {

    if (tasksLoading) {
        return (
            <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                    <TaskSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
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
                    {/* Status toggle circle */}
                    <button
                        onClick={() => onStatusChange(task.id, task.status === "Done" ? "Todo" : "Done")}
                        className={`w-5 h-5 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${task.status === "Done"
                                ? "bg-[#4C3D8F] border-[#4C3D8F]"
                                : "border-[#CBD5E1] bg-white"
                            }`}
                    >
                        {task.status === "Done" && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        )}
                    </button>

                    {/* Task info */}
                    <div className="flex-1">
                        <p className={`text-sm font-medium ${task.status === "Done" ? "text-[#94A3B8] line-through" : "text-[#1E293B]"
                            }`}>
                            {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${task.priority === "High" ? "bg-rose-500" :
                                    task.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                                }`} />
                            {task.description && (
                                <span className="text-xs text-[#94A3B8]">{task.description}</span>
                            )}
                        </div>

                        {/* AI improvement suggestion UI */}
                        {improvingTaskId === task.id && (
                            <div className="mt-2 p-3 bg-[#F8F7FF] border border-[#E8E5FF] rounded-xl">
                                {improvedDescriptions[task.id] ? (
                                    <>
                                        <p className="text-xs font-medium text-[#4C3D8F] mb-1">✨ AI Suggestion</p>
                                        <p className="text-xs text-[#1E293B] mb-2 leading-relaxed">
                                            {improvedDescriptions[task.id]}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onAcceptImprovement(task.id, improvedDescriptions[task.id]!)}
                                                className="text-xs bg-[#4C3D8F] text-white px-3 py-1.5 rounded-lg hover:bg-[#3D3173] transition-colors"
                                            >
                                                ✓ Accept
                                            </button>
                                            <button
                                                onClick={() => onDismissImprovement(task.id)}
                                                className="text-xs bg-white border border-[#DCE7F5] text-[#475569] px-3 py-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs text-[#4C3D8F]">AI is improving your description...</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Status dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenStatusDropdown(
                                openStatusDropdown === task.id ? null : task.id
                            )}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${task.status === "Todo"
                                    ? "bg-white border-[#DCE7F5] text-[#64748B]"
                                    : task.status === "InProgress"
                                        ? "bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]"
                                        : "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
                                }`}
                        >
                            {statusLabels[task.status]}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
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
                                            onClick={() => onStatusChange(task.id, s)}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg ${task.status === s
                                                    ? "bg-[#EEF2FF] text-[#4338CA] font-medium"
                                                    : "text-[#475569] hover:bg-[#F8FAFC]"
                                                }`}
                                        >
                                            {statusLabels[s]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* AI Improve button */}
                    <button
                        onClick={() => onImproveDescription(task)}
                        disabled={improvingTaskId === task.id}
                        className="text-[#4C3D8F] hover:bg-[#F8F7FF] p-1.5 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium"
                        aria-label={`Improve description for task: ${task.title}`}
                    >
                        ✨
                    </button>

                    {/* Delete button */}
                    <button
                        onClick={() => onConfirmDelete(task)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                        aria-label={`Delete task: ${task.title}`}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
