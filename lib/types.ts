import DashboardPage from "@/app/dashboard/page";

export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export type TaskUpdateInput = Partial<Task>;
// 👆 THIS is the "make everything optional" version
// Lives right here alongside your other Task-related types


export interface ApiSuccessResponse<T> {
    // 👆 Generic interface — T represents "whatever the data actually is"
    success: true;
    // 👆 LITERAL type `true` (not just `boolean`!) — this is intentional,
    //    we'll explore exactly why in tonight's discriminated unions session
    data: T;
    // 👆 The data field's type is WHATEVER T is — fully flexible
}

export interface ApiErrorResponse {
    success: false;
    message: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
// 👆 A UNION of two possible shapes — response is EITHER a success
//    shape OR an error shape, never some mix of both

// This is for Dashboard Page API call type check

export interface PaginationInfo {
    // 👆 Let's properly TYPE pagination too, instead of using "any"
    // (using "any" defeats the whole purpose of what we're learning today!)
    currentPage: number;
    totalPages: number;
    totalTasks: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface TasksApiSuccessResponse {
    // 👆 A SPECIFIC success shape, just for this one endpoint —
    // notice this does NOT reuse the generic ApiSuccessResponse<T>,
    // because THIS response's actual shape is a bit different 
    // (has count AND pagination as extra siblings, not just data)
    success: true;
    count: number;
    data: Task[];
    pagination: PaginationInfo;
}


export type TasksApiResponse = TasksApiSuccessResponse | ApiErrorResponse;
// 👆 Reusing ApiErrorResponse from before — that part stays the same,
// since errors for THIS endpoint look the same as any other endpoint