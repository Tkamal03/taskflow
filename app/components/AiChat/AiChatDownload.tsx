"use client";

import { useState } from "react";
import { Message } from "./AiMessageList";

interface AiChatDownloadProps {
    messages: Message[];
    // 👆 The conversation to download
}

export default function AiChatDownload({ messages }: AiChatDownloadProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    // 👆 Controls the PDF/Excel dropdown menu

    // ─── PDF Download ───────────────────────────────────────────
    async function downloadPDF() {
        setShowDropdown(false);

        // Dynamic import — only loads jsPDF when user clicks download
        // This keeps the initial page load fast (code splitting)
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        // 👆 A4 portrait by default — perfect for chat export

        // ── Header ──────────────────────────────────────────────
        doc.setFillColor(76, 61, 143);
        // 👆 Our app purple #4C3D8F as RGB
        doc.rect(0, 0, 210, 20, "F");
        // 👆 Purple header bar across full page width

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TaskFlow — AI Chat History", 14, 13);
        // 👆 White title text on purple header

        // ── Date ────────────────────────────────────────────────
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        const date = new Date().toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
        doc.text(`Downloaded: ${date}`, 14, 28);

        // ── Messages ─────────────────────────────────────────────
        let yPos = 36;
        // 👆 Current vertical position on the page
        const pageHeight = 280;
        const margin = 14;
        const maxWidth = 182;
        // 👆 A4 width (210) minus margins (14 each side)

        messages.forEach((msg, index) => {
            const isUser = msg.role === "user";
            const label = isUser ? "You" : "AI Assistant";
            const bgColor = isUser
                ? [240, 237, 255]   // Light purple for user
                : [248, 247, 255];  // Very light purple for AI

            // ── Wrap long text ──────────────────────────────────
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(msg.content, maxWidth - 8);
            // 👆 splitTextToSize — auto wraps text to fit within width
            // Returns array of lines

            const blockHeight = lines.length * 6 + 14;
            // 👆 Calculate total height needed for this message block
            // 6px per line + 14px padding

            // ── Page break if needed ────────────────────────────
            if (yPos + blockHeight > pageHeight) {
                doc.addPage();
                yPos = 14;
                // 👆 Start fresh on new page with top margin
            }

            // ── Background bubble ────────────────────────────────
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.roundedRect(margin, yPos, maxWidth, blockHeight, 3, 3, "F");
            // 👆 Rounded rectangle as chat bubble background

            // ── Role label ───────────────────────────────────────
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(76, 61, 143);
            // 👆 Purple label text
            doc.text(label, margin + 4, yPos + 7);

            // ── Message text ─────────────────────────────────────
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            // 👆 Dark slate text #1E293B
            doc.text(lines, margin + 4, yPos + 13);

            yPos += blockHeight + 4;
            // 👆 Move down for next message + 4px gap between bubbles
        });

        // ── Footer ───────────────────────────────────────────────
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Page ${i} of ${pageCount} — TaskFlow AI Chat`,
                14,
                290
            );
        }

        doc.save("taskflow-ai-chat.pdf");
        // 👆 Triggers browser download with this filename
    }

    // ─── Excel Download ──────────────────────────────────────────
    async function downloadExcel() {
        setShowDropdown(false);

        const XLSX = await import("xlsx");
        // 👆 Dynamic import — same pattern as PDF

        // ── Build data rows ─────────────────────────────────────
        const rows = messages.map((msg, index) => ({
            "#": index + 1,
            Role: msg.role === "user" ? "You" : "AI Assistant",
            Message: msg.content,
            "Downloaded At": new Date().toLocaleString(),
        }));
        // 👆 Each message becomes one row in the spreadsheet
        // Columns: #, Role, Message, Downloaded At

        // ── Create worksheet ────────────────────────────────────
        const worksheet = XLSX.utils.json_to_sheet(rows);
        // 👆 Converts array of objects to Excel worksheet
        // Object keys become column headers automatically

        // ── Column widths ────────────────────────────────────────
        worksheet["!cols"] = [
            { wch: 5 },   // # column
            { wch: 15 },  // Role column
            { wch: 80 },  // Message column — wide for long text
            { wch: 22 },  // Downloaded At column
        ];
        // 👆 wch = width in characters

        // ── Create workbook ──────────────────────────────────────
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "AI Chat");
        // 👆 Sheet name appears as the tab name in Excel

        XLSX.writeFile(workbook, "taskflow-ai-chat.xlsx");
        // 👆 Triggers browser download
    }

    // ── Don't render if no messages ──────────────────────────────
    if (messages.length === 0) return null;
    // 👆 No point showing download button for empty conversation

    return (
        <div className="relative">
            {/* Download icon button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-7 h-7 rounded-lg bg-[#F8F7FF] hover:bg-[#EEF2FF] flex items-center justify-center transition-colors"
                title="Download conversation"
                aria-label="Download conversation"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4C3D8F" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
                <>
                    {/* Click outside to close */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute top-9 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-lg w-36 p-1 z-20">

                        {/* PDF option */}
                        <button
                            onClick={downloadPDF}
                            className="w-full text-left px-3 py-2 text-xs text-[#475569] hover:bg-[#F8F7FF] hover:text-[#4C3D8F] rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Download PDF
                        </button>

                        {/* Excel option */}
                        <button
                            onClick={downloadExcel}
                            className="w-full text-left px-3 py-2 text-xs text-[#475569] hover:bg-[#F8F7FF] hover:text-[#4C3D8F] rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <polyline points="8 13 10 17 12 13 14 17 16 13" />
                            </svg>
                            Download Excel
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
