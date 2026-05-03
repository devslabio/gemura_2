import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Canonical demo password for seeded users (login identifier = phone). */
const SEED_DEMO_PASSWORD = 'Pass123!';

async function main() {
  console.log('🌱 Starting database seed...');

  const hashedPassword = await bcrypt.hash(SEED_DEMO_PASSWORD, 10);

  // Generate a simple token (in production, this would be JWT)
  const authToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 1. Create main user account
  console.log('👤 Creating main user account...');
  const mainAccount = await prisma.account.upsert({
    where: { code: 'ACC_MAIN_001' },
    update: { name: 'Nyabihu Cooperative MCC' },
    create: {
      code: 'ACC_MAIN_001',
      name: 'Nyabihu Cooperative MCC',
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
      email: 'system.admin@gemura.rw',
      password_hash: hashedPassword,
      token: authToken,
      default_account_id: mainAccount.id,
    },
    create: {
      code: 'USER_MAIN_001',
      name: 'System Admin',
      email: 'system.admin@gemura.rw',
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
    update: {
      role: 'system_admin',
      status: 'active',
    },
    create: {
      user_id: mainUser.id,
      account_id: mainAccount.id,
      role: 'system_admin',
      permissions: { can_manage: true, can_view: true, can_edit: true },
      status: 'active',
      legacy_id: BigInt(1),
    },
  });
  console.log('✅ User linked to main account');

  // 3b. One login per platform role (operators on Main MCC; supplier/customer separate)
  const roleDemoOnMain = [
    { phone: '250788409021', code: 'U_ROLE_ADM', name: 'Demo Admin', role: 'admin', email: 'admin@gemura.rw' },
    { phone: '250788409022', code: 'U_ROLE_MGR', name: 'Demo Manager', role: 'manager', email: 'manager@gemura.rw' },
    { phone: '250788409028', code: 'U_ROLE_VET', name: 'Demo Veterinary Officer', role: 'veterinary_officer', email: 'veterinary.officer@gemura.rw' },
    { phone: '250788409029', code: 'U_ROLE_LBR', name: 'Demo Casual Laborer', role: 'casual_laborer', email: 'casual.laborer@gemura.rw' },
    { phone: '250788409030', code: 'U_ROLE_LED', name: 'Demo Leadership', role: 'leadership', email: 'leadership@gemura.rw' },
    { phone: '250788409031', code: 'U_ROLE_REG', name: 'Demo Regulator', role: 'regulator', email: 'regulator@gemura.rw' },
    { phone: '250788409032', code: 'U_ROLE_UMA', name: 'Demo Umucunda Type A', role: 'umucunda_a', email: 'umucunda.a@gemura.rw' },
    { phone: '250788409033', code: 'U_ROLE_UMB', name: 'Demo Umucunda Type B', role: 'umucunda_b', email: 'umucunda.b@gemura.rw' },
    { phone: '250788409023', code: 'U_ROLE_ACC', name: 'Demo Accountant', role: 'accountant', email: 'accountant@gemura.rw' },
    { phone: '250788409024', code: 'U_ROLE_COL', name: 'Demo Collector', role: 'collector', email: 'collector@gemura.rw' },
    { phone: '250788409025', code: 'U_ROLE_VWR', name: 'Demo Viewer', role: 'viewer', email: 'viewer@gemura.rw' },
    { phone: '250788409026', code: 'U_ROLE_AGT', name: 'Demo Agent', role: 'agent', email: 'agent@gemura.rw' },
  ] as const;
  console.log('👥 Creating platform role demo users (Main MCC)...');
  for (const row of roleDemoOnMain) {
    const u = await prisma.user.upsert({
      where: { phone: row.phone },
      update: {
        name: row.name,
        code: row.code,
        email: row.email,
        password_hash: hashedPassword,
        default_account_id: mainAccount.id,
        account_type: 'mcc',
        status: 'active',
      },
      create: {
        code: row.code,
        name: row.name,
        phone: row.phone,
        email: row.email,
        password_hash: hashedPassword,
        account_type: 'mcc',
        status: 'active',
        default_account_id: mainAccount.id,
        token: `token_${row.phone}_${Date.now()}`,
      },
    });
    await prisma.userAccount.upsert({
      where: {
        user_id_account_id: { user_id: u.id, account_id: mainAccount.id },
      },
      update: {
        role: row.role,
        status: 'active',
      },
      create: {
        user_id: u.id,
        account_id: mainAccount.id,
        role: row.role,
        permissions: {},
        status: 'active',
      },
    });
  }
  console.log(
    `✅ Role demos on ${mainAccount.code}: admin, manager, veterinary_officer, casual_laborer, leadership, regulator, umucunda_a, umucunda_b, accountant, collector, viewer, agent`,
  );

  const demoCustomerAccount = await prisma.account.upsert({
    where: { code: 'A_ROLE_DEMO_CUST' },
    update: { name: 'Role Demo Customer Org', status: 'active' },
    create: {
      code: 'A_ROLE_DEMO_CUST',
      name: 'Role Demo Customer Org',
      type: 'tenant',
      status: 'active',
    },
  });
  await prisma.wallet.upsert({
    where: { code: 'W_ROLE_DEMO_CUST' },
    update: {},
    create: {
      code: 'W_ROLE_DEMO_CUST',
      account_id: demoCustomerAccount.id,
      type: 'regular',
      is_joint: false,
      is_default: true,
      balance: 0,
      currency: 'RWF',
      status: 'active',
    },
  });
  const demoCustomerUser = await prisma.user.upsert({
    where: { phone: '250788409027' },
    update: {
      name: 'Demo Customer',
      code: 'U_ROLE_CUST',
      email: 'customer@gemura.rw',
      password_hash: hashedPassword,
      default_account_id: demoCustomerAccount.id,
      account_type: 'customer',
      status: 'active',
    },
    create: {
      code: 'U_ROLE_CUST',
      name: 'Demo Customer',
      phone: '250788409027',
      email: 'customer@gemura.rw',
      password_hash: hashedPassword,
      account_type: 'customer',
      status: 'active',
      default_account_id: demoCustomerAccount.id,
      token: `token_role_cust_${Date.now()}`,
    },
  });
  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: {
        user_id: demoCustomerUser.id,
        account_id: demoCustomerAccount.id,
      },
    },
    update: { role: 'customer', status: 'active' },
    create: {
      user_id: demoCustomerUser.id,
      account_id: demoCustomerAccount.id,
      role: 'customer',
      permissions: {},
      status: 'active',
    },
  });
  console.log(`✅ Customer role demo: ${demoCustomerUser.phone} → ${demoCustomerAccount.code}`);

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
      balance: 1000000, // 1,000,000 RWF starting balance
      currency: 'RWF',
      status: 'active',
      legacy_id: BigInt(1),
    },
  });
  console.log(`✅ Main wallet created: ${mainWallet.code} (Balance: ${mainWallet.balance} RWF)`);

  // 5. Create test supplier accounts and users
  console.log('🥛 Creating test suppliers...');
  const suppliers = [
    {
      name: 'Jean Baptiste Uwimana',
      phone: '250788111222',
      email: 'jean@supplier.rw',
      nid: '1198712345678901',
      price_per_liter: 400,
      address: 'Kigali, Gasabo',
      code: 'A_SUP_001',
      user_code: 'USER_SUP_001',
      wallet_code: 'W_SUP_001',
    },
    {
      name: 'Marie Claire Mukamana',
      phone: '250788333444',
      email: 'marie@supplier.rw',
      nid: '1199823456789012',
      price_per_liter: 390,
      address: 'Kigali, Kicukiro',
      code: 'A_SUP_002',
      user_code: 'USER_SUP_002',
      wallet_code: 'W_SUP_002',
    },
    {
      name: 'Pierre Nkurunziza',
      phone: '250788555666',
      email: 'pierre@supplier.rw',
      nid: '1198934567890123',
      price_per_liter: 410,
      address: 'Kigali, Nyarugenge',
      code: 'A_SUP_003',
      user_code: 'USER_SUP_003',
      wallet_code: 'W_SUP_003',
    },
  ];

  for (const supplier of suppliers) {
    // Create supplier account
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

    // Create supplier user
    const supplierUser = await prisma.user.upsert({
      where: { code: supplier.user_code },
      update: {
        password_hash: hashedPassword,
      },
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

    // Link supplier user to account
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
        role: 'supplier',
        permissions: { can_view: true },
        status: 'active',
      },
    });

    // Create supplier wallet
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

    // Create supplier-customer relationship (upsert to avoid duplicate key on re-seed)
    await prisma.supplierCustomer.upsert({
      where: {
        supplier_account_id_customer_account_id: {
          supplier_account_id: supplierAccount.id,
          customer_account_id: mainAccount.id,
        },
      },
      update: {
        price_per_liter: supplier.price_per_liter,
        relationship_status: 'active',
      },
      create: {
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
    {
      supplier_code: 'A_SUP_001',
      quantity: 150.5,
      price: 400,
      date: new Date('2025-01-01 08:00:00'),
      status: 'accepted',
    },
    {
      supplier_code: 'A_SUP_001',
      quantity: 120.0,
      price: 400,
      date: new Date('2025-01-02 08:00:00'),
      status: 'accepted',
    },
    {
      supplier_code: 'A_SUP_002',
      quantity: 200.0,
      price: 390,
      date: new Date('2025-01-01 08:30:00'),
      status: 'accepted',
    },
    {
      supplier_code: 'A_SUP_002',
      quantity: 180.5,
      price: 390,
      date: new Date('2025-01-02 08:30:00'),
      status: 'accepted',
    },
    {
      supplier_code: 'A_SUP_003',
      quantity: 95.0,
      price: 410,
      date: new Date('2025-01-01 09:00:00'),
      status: 'accepted',
    },
    {
      supplier_code: 'A_SUP_003',
      quantity: 110.0,
      price: 410,
      date: new Date('2025-01-02 09:00:00'),
      status: 'pending',
    },
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
          status: collection.status as any,
          sale_at: collection.date,
          recorded_by: mainUser.id,
        },
      });
    }
  }
  console.log(`✅ Created ${collections.length} milk collections`);

  // 7. Create sample categories
  console.log('📦 Creating categories...');
  const categories = [
    { name: 'Dairy Products', description: 'Milk and dairy products' },
    { name: 'Animal Feed', description: 'Feed for livestock' },
    { name: 'Veterinary Supplies', description: 'Medical supplies for animals' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        description: category.description,
      },
    });
  }
  console.log(`✅ Created ${categories.length} categories`);

  // 8. Create sample products
  console.log('📦 Creating sample products...');
  const dairyCategory = await prisma.category.findUnique({
    where: { name: 'Dairy Products' },
  });
  const feedCategory = await prisma.category.findUnique({
    where: { name: 'Animal Feed' },
  });

  if (dairyCategory && feedCategory) {
    const products = [
      {
        name: 'Fresh Milk (1L)',
        description: 'Fresh pasteurized milk',
        price: 1200,
        stock: 500,
        category: dairyCategory,
      },
      {
        name: 'Yogurt (500ml)',
        description: 'Natural yogurt',
        price: 800,
        stock: 300,
        category: dairyCategory,
      },
      {
        name: 'Cattle Feed (25kg)',
        description: 'Nutritious cattle feed',
        price: 15000,
        stock: 100,
        category: feedCategory,
      },
    ];

    for (const product of products) {
      const createdProduct = await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          stock_quantity: product.stock,
          status: 'active',
        },
      });

      // Link product to category
      await prisma.productCategory.create({
        data: {
          product_id: createdProduct.id,
          category_id: product.category.id,
        },
      });
    }
    console.log(`✅ Created ${products.length} products`);
  }

  // 9. Create sample animals (Orora – cattle) for main account
  console.log('🐄 Creating sample animals...');
  const holstein = await prisma.breed.findFirst({ where: { code: 'HOLSTEIN' } });
  const angus = await prisma.breed.findFirst({ where: { code: 'ANGUS' } });
  const cattleSpeciesId = holstein?.species_id ?? angus?.species_id;
  const animalData = [
    { tag_number: 'TAG-001', name: 'Bella', breed_id: holstein?.id, gender: 'female' as const, date_of_birth: new Date('2022-03-15'), source: 'born_on_farm' as const, status: 'active' as const },
    { tag_number: 'TAG-002', name: 'Max', breed_id: angus?.id, gender: 'male' as const, date_of_birth: new Date('2021-06-20'), source: 'purchased' as const, status: 'active' as const },
  ];
  let animalsCreated = 0;
  if (holstein && angus && cattleSpeciesId) {
    for (const a of animalData) {
      await prisma.animal.upsert({
        where: {
          account_id_tag_number: { account_id: mainAccount.id, tag_number: a.tag_number },
        },
        update: {},
        create: {
          account_id: mainAccount.id,
          species_id: cattleSpeciesId,
          breed_id: a.breed_id!,
          tag_number: a.tag_number,
          name: a.name,
          gender: a.gender,
          date_of_birth: a.date_of_birth,
          source: a.source,
          status: a.status,
          created_by: mainUser.id,
        },
      });
      animalsCreated++;
    }
    console.log(`✅ Created ${animalsCreated} sample animals`);
  } else {
    console.warn('⚠️ Breeds HOLSTEIN or ANGUS not found; skipping sample animals.');
  }

  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('📋 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔑 All seeded demo logins use password: ${SEED_DEMO_PASSWORD}`);
  console.log(`👤 system_admin: ${mainUser.phone} (${mainAccount.code})`);
  console.log('👤 Main MCC role demos:');
  console.log('   250788409021 admin · 250788409022 manager · 250788409028 veterinary_officer');
  console.log('   250788409029 casual_laborer · 250788409030 leadership · 250788409031 regulator');
  console.log('   250788409032 umucunda_a · 250788409033 umucunda_b · 250788409023 accountant');
  console.log('   250788409024 collector · 250788409025 viewer · 250788409026 agent');
  console.log(`👤 supplier (Jean Baptiste): 250788111222 (+ 250788333444, 250788555666)`);
  console.log(`👤 customer (own account): 250788409027`);
  console.log(`📧 Main email: ${mainUser.email}`);
  console.log(`🎫 Token: ${authToken}`);
  console.log(`💼 Account: ${mainAccount.code}`);
  console.log(`💰 Wallet Balance: ${mainWallet.balance} RWF`);
  console.log(`🥛 Suppliers: 3`);
  console.log(`📦 Collections: ${collections.length}`);
  console.log(`📦 Products: 3`);
  console.log(`🐄 Animals: ${animalsCreated}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚛 MCC Operations (gate, manifests, shifts, tests): npm run seed:mcc-gate-demo');
  console.log('   Uses realistic week-spread demo on ACC_MAIN_001; safe to re-run (idempotent).\n');
  console.log('🧪 Test the API:');
  console.log('1. Login: POST http://159.198.65.38:3004/api/auth/login');
  console.log(`   Body: { "identifier": "250788606765", "password": "${SEED_DEMO_PASSWORD}" }`);
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
