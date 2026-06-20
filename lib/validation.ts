// 👆 Centralized validation logic — reusable across register, login, task forms
// Avoids repeating the same regex/checks in multiple files

export function validateEmail(email: string): string | null {
    // 👆 Returns null if valid, or an error message string if invalid
    // This pattern lets us do: const error = validateEmail(x); if (error) {...}

    if (!email.trim()) {
        return "Email is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // 👆 Regex breakdown:
    // ^[^\s@]+ — one or more chars that are NOT space or @ (before the @)
    // @        — literal @ symbol
    // [^\s@]+  — one or more chars that are NOT space or @ (domain name)
    // \.       — literal dot
    // [^\s@]+$ — one or more chars that are NOT space or @ (extension like com)
    // Or we can use this Regex pattern => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

    if (!emailRegex.test(email)) {
        return "Please enter a valid email address";
    }

    return null;
    // 👆 No errors found
}

export function validatePassword(password: string): string | null {
    if (!password) {
        return "Password is required";
    }

    if (password.length < 6) {
        return "Password must be at least 6 characters";
    }

    return null;
}

export function validateName(name: string): string | null {
    if (!name.trim()) {
        return "Name is required";
    }

    if (name.trim().length < 2) {
        return "Name must be at least 2 characters";
    }

    return null;
}

export function validateTaskTitle(title: string): string | null {
    if (!title.trim()) {
        return "Task title is required";
    }

    if (title.trim().length > 100) {
        // 👆 Prevents extremely long titles breaking UI layout
        return "Task title must be less than 100 characters";
    }

    return null;
}