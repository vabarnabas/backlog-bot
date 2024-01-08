import { PrismaClient } from "@prisma/client";
let prisma;
if (!global.__prisma) {
    global.__prisma = new PrismaClient();
}
// eslint-disable-next-line prefer-const
prisma = global.__prisma;
export { prisma };
//# sourceMappingURL=prisma.js.map