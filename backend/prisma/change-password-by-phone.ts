import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Defaults for convenience; can be overridden via env vars.
const TARGET_PHONE = (process.env.CHANGE_PASSWORD_PHONE || '250788596693').replace(/\D/g, '');
const NEW_PASSWORD = process.env.CHANGE_PASSWORD_NEW_PASSWORD || 'Pass123!';

async function main() {
  console.log('🔐 Changing password by phone...');
  console.log(`➡️  Phone: ${TARGET_PHONE}`);

  const user = await prisma.user.findFirst({
    where: { phone: TARGET_PHONE },
  });

  if (!user) {
    console.log('⚠️ No user found with that phone number.');
    return;
  }

  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: hashedPassword,
    },
  });

  console.log('✅ Password updated successfully.');
  console.log(`   User: ${user.name} (${user.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Error changing password:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

