export default function TaskSkeleton() {
    // 👆 No "use client" needed — this is just static decorative markup
    // It's used INSIDE a client component, but doesn't itself need interactivity

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm animate-pulse">
            {/* 👆 animate-pulse — Tailwind's built-in pulsing/fading animation */}
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
                    {/* 👆 Gray bar — mimics where the task TITLE will appear */}
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-3"></div>
                    {/* 👆 Gray bar — mimics where the DESCRIPTION will appear */}
                    <div className="h-5 bg-gray-100 rounded-full w-16"></div>
                    {/* 👆 Small rounded bar — mimics the PRIORITY badge */}
                </div>
            </div>
        </div>
    );
}