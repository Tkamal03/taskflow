import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// 👆 Same OpenAI client pattern we use in all AI routes

export async function generateEmbedding(text: string): Promise<number[]> {
    // ⭐ Core utility function — converts any text to a vector
    // Returns an array of 1536 numbers

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        // 👆 OpenAI's most efficient embedding model
        // Cheaper than text-embedding-3-large
        // 1536 dimensions — matches our vector(1536) column
        input: text,
        // 👆 The text we want to convert to a vector
    });

    return response.data[0].embedding;
    // 👆 Returns the array of 1536 numbers
    // response.data[0] — first (and only) result
    // .embedding — the actual vector array
}
export function buildTaskText(
    title: string,
    description?: string | null,
    priority?: string | null,
    status?: string | null
): string {
    // ⭐ Include priority and status in the embedding text
    // This way "urgency" searches will correctly rank
    // High priority tasks higher than Low priority ones

    const parts = [title];
    // 👆 Always start with the title

    if (priority) parts.push(`Priority: ${priority}`);
    // 👆 "Priority: High" or "Priority: Low"
    // Now the vector KNOWS this task's priority level
    // High priority tasks will be closer to "urgent" searches

    if (status) parts.push(`Status: ${status}`);
    // 👆 "Status: Todo" or "Status: Done"
    // Now "completed tasks" searches work correctly too

    if (description) parts.push(description);
    // 👆 Description last — adds more context

    return parts.join(". ");
    // 👆 Joins all parts with ". " separator
    // Result: "Fix login bug. Priority: High. Status: Todo. Users can't sign in"
}
