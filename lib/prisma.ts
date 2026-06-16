import { PrismaClient } from "@prisma/client";
// 👆 Import Prisma client

declare global {
    var prisma: PrismaClient | undefined;
    // 👆 Global declaration prevents multiple instances
}

const prisma = global.prisma || new PrismaClient();
// 👆 Reuse existing OR create new instance

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
    // 👆 Save to global in development only
}

export default prisma;
// 👆 Import this everywhere: import prisma from "@/lib/prisma"