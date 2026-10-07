"use client";

interface NewTask {
    title: string;
    description: string;
    priority: string;
}

interface AddTaskFormProps {
    newTask: NewTask;
    onNewTaskChange: (task: NewTask) => void;
    onAddTask: () => void;
    prioritySuggesting: boolean;
    priorityReason: string;
    onSuggestPriority: () => void;
    onPriorityManualSelect: (priority: string) => void;
}

export default function AddTaskForm({
    newTask,
    onNewTaskChange,
    onAddTask,
    prioritySuggesting,
    priorityReason,
    onSuggestPriority,
    onPriorityManualSelect,
}: AddTaskFormProps) {
    return (
        <div className="bg-gradient-to-br from-[#DCE4FA] to-[#C5D2F2] border border-white/60 rounded-2xl p-3.5 mb-4.5 animate-[slideDown_0.25s_ease-out]">
            <div className="bg-white/55 backdrop-blur-md rounded-[14px] p-4">
                <div className="flex flex-col gap-2.5">

                    {/* Title input */}
                    <input
                        type="text"
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => onNewTaskChange({ ...newTask, title: e.target.value })}
                        className="bg-white border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#3B6FE0]"
                    />

                    {/* Description input */}
                    <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newTask.description}
                        onChange={(e) => onNewTaskChange({ ...newTask, description: e.target.value })}
                        className="bg-white border border-[#DCE7F5] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder-[#94A3B8] outline-none focus:border-[#3B6FE0]"
                    />

                    {/* Priority section */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-[#334155]">Priority</span>

                            {/* AI Suggest button */}
                            <button
                                onClick={onSuggestPriority}
                                disabled={prioritySuggesting || !newTask.title.trim()}
                                className="text-[11px] text-[#4C3D8F] hover:text-[#3D3173] font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {prioritySuggesting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-[#4C3D8F] border-t-transparent rounded-full animate-spin" />
                                        Suggesting...
                                    </>
                                ) : (
                                    <>✨ AI Suggest</>
                                )}
                            </button>
                        </div>

                        {/* Priority chips */}
                        <div className="flex gap-2">
                            {["Low", "Medium", "High"].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => onPriorityManualSelect(p)}
                                    className={`flex-1 text-center py-2 rounded-lg text-[13px] font-medium border transition-colors ${newTask.priority === p
                                        ? p === "Low"
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                            : p === "Medium"
                                                ? "bg-amber-50 border-amber-300 text-amber-700"
                                                : "bg-rose-50 border-rose-300 text-rose-700"
                                        : "bg-white border-[#DCE7F5] text-[#64748B]"
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {/* AI priority reason */}
                        {priorityReason && (
                            <p className="text-[11px] text-[#4C3D8F] bg-[#F8F7FF] border border-[#E8E5FF] rounded-lg px-2.5 py-1.5">
                                ✨ AI suggests <strong>{newTask.priority}</strong>: {priorityReason}
                            </p>
                        )}
                    </div>

                    {/* Add task button */}
                    <button
                        onClick={onAddTask}
                        className="bg-[#4C3D8F] hover:bg-[#3D3173] text-white font-medium text-sm py-2.5 rounded-xl shadow-[0_8px_20px_rgba(76,61,143,0.4)] transition-colors mt-1"
                    >
                        Add task
                    </button>
                </div>
            </div>
        </div>
    );
}
