const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash the password
  const hashedPassword = await bcrypt.hash('Pass123!', 10);

  // Generate a simple token
  const authToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 1. Create main user account
  console.log('👤 Creating main user account...');
  const mainAccount = await prisma.account.upsert({
    where: { code: 'ACC_MAIN_001' },
    update: {},
    create: {
      code: 'ACC_MAIN_001',
      name: 'Main MCC Account',
      type: 'tenant',
      status: 'active',
      legacy_id: BigInt(1),
    },
  });
  console.log(`✅ Main account created: ${mainAccount.code}`);

  // 2. Create main user
  console.log('👤 Creating main user...');
  const mainUser = await prisma.user.upsert({
    where: { code: 'USER_MAIN_001' },
    update: {
      name: 'System Admin',
      password_hash: hashedPassword,
      token: authToken,
    },
    create: {
      code: 'USER_MAIN_001',
      name: 'System Admin',
      email: 'admin@gemura.rw',
      phone: '250788606765',
      password_hash: hashedPassword,
      account_type: 'mcc',
      status: 'active',
      token: authToken,
      default_account_id: mainAccount.id,
      legacy_id: BigInt(1),
    },
  });
  console.log(`✅ Main user created: ${mainUser.phone}`);
  console.log(`🔑 Auth token: ${authToken}`);

  // 3. Link user to main account
  console.log('🔗 Linking user to main account...');
  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: {
        user_id: mainUser.id,
        account_id: mainAccount.id,
      },
    },
    update: {},
    create: {
      user_id: mainUser.id,
      account_id: mainAccount.id,
      role: 'owner',
      permissions: { can_manage: true, can_view: true, can_edit: true },
      status: 'active',
      legacy_id: BigInt(1),
    },
  });
  console.log('✅ User linked to main account');

  // 4. Create main account wallet
  console.log('💰 Creating main account wallet...');
  const mainWallet = await prisma.wallet.upsert({
    where: { code: 'W_MAIN_001' },
    update: {},
    create: {
      code: 'W_MAIN_001',
      account_id: mainAccount.id,
      type: 'regular',
      is_joint: false,
      is_default: true,
      balance: 1000000,
      currency: 'RWF',
      status: 'active',
      legacy_id: BigInt(1),
    },
  });
  console.log(`✅ Main wallet created: ${mainWallet.code} (Balance: ${mainWallet.balance} RWF)`);

  // 5. Create test suppliers
  console.log('🥛 Creating test suppliers...');
  const suppliers = [
    {
      name: 'Demo Supplier',
      phone: '250788409034',
      email: 'supplier@gemura.rw',
      nid: '1198712345678901',
      price_per_liter: 400,
      address: 'Kigali, Gasabo',
      code: 'A_SUP_001',
      user_code: 'USER_SUP_001',
      wallet_code: 'W_SUP_001',
    },
  ];

  for (const supplier of suppliers) {
    const supplierAccount = await prisma.account.upsert({
      where: { code: supplier.code },
      update: {},
      create: {
        code: supplier.code,
        name: `${supplier.name} - Supplier`,
        type: 'tenant',
        status: 'active',
      },
    });

    const supplierUser = await prisma.user.upsert({
      where: { code: supplier.user_code },
      update: {},
      create: {
        code: supplier.user_code,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        password_hash: hashedPassword,
        account_type: 'supplier',
        status: 'active',
        token: `token_${supplier.phone}`,
        default_account_id: supplierAccount.id,
        nid: supplier.nid,
        address: supplier.address,
      },
    });

    await prisma.userAccount.upsert({
      where: {
        user_id_account_id: {
          user_id: supplierUser.id,
          account_id: supplierAccount.id,
        },
      },
      update: {},
      create: {
        user_id: supplierUser.id,
        account_id: supplierAccount.id,
        role: 'owner',
        permissions: { can_view: true },
        status: 'active',
      },
    });

    await prisma.wallet.upsert({
      where: { code: supplier.wallet_code },
      update: {},
      create: {
        code: supplier.wallet_code,
        account_id: supplierAccount.id,
        type: 'regular',
        is_joint: false,
        is_default: true,
        balance: 0,
        currency: 'RWF',
        status: 'active',
      },
    });

    await prisma.supplierCustomer.create({
      data: {
        supplier_account_id: supplierAccount.id,
        customer_account_id: mainAccount.id,
        price_per_liter: supplier.price_per_liter,
        relationship_status: 'active',
      },
    });

    console.log(`✅ Supplier created: ${supplier.name} (${supplier.code})`);
  }

  // 6. Create sample milk collections
  console.log('📦 Creating sample milk collections...');
  const collections = [
    { supplier_code: 'A_SUP_001', quantity: 150.5, price: 400, date: new Date('2025-01-01 08:00:00'), status: 'accepted' },
    { supplier_code: 'A_SUP_001', quantity: 120.0, price: 400, date: new Date('2025-01-02 08:00:00'), status: 'accepted' },
    { supplier_code: 'A_SUP_001', quantity: 200.0, price: 390, date: new Date('2025-01-01 08:30:00'), status: 'accepted' },
    { supplier_code: 'A_SUP_001', quantity: 180.5, price: 390, date: new Date('2025-01-02 08:30:00'), status: 'accepted' },
    { supplier_code: 'A_SUP_001', quantity: 95.0, price: 410, date: new Date('2025-01-01 09:00:00'), status: 'accepted' },
    { supplier_code: 'A_SUP_001', quantity: 110.0, price: 410, date: new Date('2025-01-02 09:00:00'), status: 'pending' },
  ];

  for (const collection of collections) {
    const supplierAccount = await prisma.account.findUnique({
      where: { code: collection.supplier_code },
    });

    if (supplierAccount) {
      await prisma.milkSale.create({
        data: {
          supplier_account_id: supplierAccount.id,
          customer_account_id: mainAccount.id,
          quantity: collection.quantity,
          unit_price: collection.price,
          status: collection.status,
          sale_at: collection.date,
          recorded_by: mainUser.id,
        },
      });
    }
  }
  console.log(`✅ Created ${collections.length} milk collections`);

  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('📋 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 Main User: ${mainUser.phone}`);
  console.log(`📧 Email: ${mainUser.email}`);
  console.log(`🔑 Password: Pass123!`);
  console.log(`🎫 Token: ${authToken}`);
  console.log(`💼 Account: ${mainAccount.code}`);
  console.log(`💰 Wallet Balance: ${mainWallet.balance} RWF`);
  console.log(`🥛 Suppliers: 3`);
  console.log(`📦 Collections: ${collections.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🧪 Test the API:');
  console.log('1. Login: POST http://159.198.65.38:3004/api/auth/login');
  console.log('   Body: { "identifier": "250788606765", "password": "Pass123!" }');
  console.log('\n2. Use the returned token for authenticated requests');
  console.log('   Header: Authorization: Bearer <token>');
  console.log('\n📚 Swagger Docs: http://159.198.65.38:3004/api/docs\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

