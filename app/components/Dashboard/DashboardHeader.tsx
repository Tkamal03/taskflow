"use client";

interface DashboardHeaderProps {
    userName: string | null | undefined;
    userEmail: string | null | undefined;
    onLogout: () => void;
    userMenuOpen: boolean;
    setUserMenuOpen: (open: boolean) => void;
}

export default function DashboardHeader({
    userName,
    userEmail,
    onLogout,
    userMenuOpen,
    setUserMenuOpen,
}: DashboardHeaderProps) {
    return (
        <div className="bg-white/55 backdrop-blur-md border-b border-white/70 px-8 py-3.5 flex items-center justify-between">

            {/* Logo + App name */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[9px] bg-[#4C3D8F] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M8 6C5.5 6 4 8 4 10.5C4 13 6 15 8.5 15C11 15 13 13 13 10.5"
                            stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                        <path d="M16 18C18.5 18 20 16 20 13.5C20 11 18 9 15.5 9C13 9 11 11 11 13.5"
                            stroke="white" strokeWidth="2.3" strokeLinecap="round" fill="none" />
                    </svg>
                </div>
                <span className="text-base font-semibold text-[#1E3A5F] font-display">TaskFlow</span>
            </div>

            {/* User avatar menu */}
            <div className="relative">
                <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="w-9 h-9 rounded-full bg-[#4C3D8F] text-white flex items-center justify-center text-sm font-semibold cursor-pointer"
                    aria-label={`Open menu for ${userName || "your account"}`}
                >
                    {userName?.charAt(0).toUpperCase() || "U"}
                </button>

                {userMenuOpen && (
                    <>
                        {/* Click outside overlay */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setUserMenuOpen(false)}
                        />
                        {/* Dropdown menu */}
                        <div className="absolute top-11 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-lg w-48 p-1.5 z-20">
                            <div className="px-3 py-2 text-xs text-[#64748B] flex items-center gap-2 truncate">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                                </svg>
                                {userEmail}
                            </div>
                            <div className="h-px bg-[#F1F5F9] my-1" />
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <path d="M16 17l5-5-5-5" />
                                    <path d="M21 12H9" />
                                </svg>
                                Log out
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
