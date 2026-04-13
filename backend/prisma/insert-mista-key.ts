import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mistaApiKey = '776|dg4GPWAJzyc6OMF9U0quArNMBylw9fGvtMjXj4Ey';

  // Check if Mista key already exists
  const existing = await prisma.apiKey.findFirst({
    where: {
      name: {
        contains: 'mista',
        mode: 'insensitive',
      },
    },
  });

  if (existing) {
    console.log('✅ Mista SMS API key already exists:', existing.id);
    console.log('   Name:', existing.name);
    console.log('   Active:', existing.is_active);
    console.log('   Created:', existing.created_at);
    
    // Update if needed
    if (existing.key !== mistaApiKey || !existing.is_active) {
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: {
          key: mistaApiKey,
          is_active: true,
        },
      });
      console.log('✅ Updated Mista API key');
    }
  } else {
    // Insert new key
    const newKey = await prisma.apiKey.create({
      data: {
        key: mistaApiKey,
        name: 'Mista SMS',
        description: 'Mista SMS API key for sending SMS notifications',
        is_active: true,
        scopes: ['sms:send'],
        rate_limit: 10000,
      },
    });
    console.log('✅ Inserted Mista SMS API key:', newKey.id);
    console.log('   Name:', newKey.name);
    console.log('   Created:', newKey.created_at);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
