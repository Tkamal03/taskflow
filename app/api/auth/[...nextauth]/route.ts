import { handlers } from "@/auth";
// 👆 Import handlers from our auth config

export const { GET, POST } = handlers;
// 👆 This one file handles ALL NextAuth API calls
// Never needs to change!