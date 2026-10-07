"use client";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalTasks: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({
    currentPage,
    totalPages,
    totalTasks,
    onPageChange,
}: PaginationProps) {
    if (totalPages <= 1) return null;
    // 👆 Don't render pagination at all if only 1 page
    // Cleaner than wrapping in {totalPages > 1 && (...)} in parent

    return (
        <>
            <div className="flex justify-center items-center gap-4 mt-6">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white/70 border border-[#DCE7F5] rounded-lg font-medium text-sm text-[#475569] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                >
                    ← Previous
                </button>
                <span className="text-[#64748B] text-sm font-medium">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white/70 border border-[#DCE7F5] rounded-lg font-medium text-sm text-[#475569] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                >
                    Next →
                </button>
            </div>

            <p className="text-center text-[#94A3B8] text-xs mt-3">
                {totalTasks} total task{totalTasks !== 1 ? "s" : ""}
            </p>
        </>
    );
}
