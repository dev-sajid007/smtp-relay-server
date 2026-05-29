import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.admin.upsert({
    where: { email: "admin@emailrelay.local" },
    update: { password },
    create: {
      email: "admin@emailrelay.local",
      password,
    },
  });

  console.log("Seeded admin:", admin.email, "(password: admin123)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
