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

export function buildTaskText(title: string, description?: string | null): string {
    // ⭐ Helper — combines title + description into one string
    // for embedding. We embed BOTH together for richer meaning.
    return description
        ? `${title}. ${description}`
        : title;
    // 👆 "Fix login bug. Users can't sign in on mobile"
    // If no description, just use the title
}
