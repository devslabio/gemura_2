/**
 * V1 → V2 Migration Service
 * 
 * Handles the complete migration from V1 (MySQL) to V2 (PostgreSQL)
 * Based on zoea2 migration pattern
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import { composeUserFullName, splitIntoFirstLast } from '../common/utils/user-name.util';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private v1Connection: mysql.Connection | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Initialize V1 database connection
   */
  async connectV1(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Promise<void> {
    try {
      this.v1Connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        authPlugins: {
          mysql_native_password: () => () => Buffer.from(config.password),
        },
      });
      this.logger.log('Connected to V1 database');
    } catch (error: any) {
      this.logger.error(`Failed to connect to MySQL: ${error.message}`);
      // Try alternative connection without auth plugin
      this.v1Connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password || '',
        database: config.database,
      });
      this.logger.log('Connected to V1 database (alternative method)');
    }
  }

  /**
   * Close V1 database connection
   */
  async disconnectV1(): Promise<void> {
    if (this.v1Connection) {
      await this.v1Connection.end();
      this.v1Connection = null;
      this.logger.log('Disconnected from V1 database');
    }
  }

  /**
   * Migrate accounts from V1 to V2
   */
  async migrateAccounts(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM accounts');
    const accounts = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1Account of accounts) {
      try {
        // Check if already migrated
        const existing = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Account.id) },
        });
        if (existing) {
          this.logger.log(`Account ${v1Account.id} already migrated, skipping`);
          success++;
          continue;
        }

        // Map parent_id if exists
        let parentId = null;
        if (v1Account.parent_id) {
          const parent = await this.prisma.account.findUnique({
            where: { legacy_id: BigInt(v1Account.parent_id) },
          });
          if (parent) {
            parentId = parent.id;
          }
        }

        // Map created_by and updated_by to user UUIDs
        let createdBy = null;
        if (v1Account.created_by) {
          const creator = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Account.created_by) },
          });
          if (creator) {
            createdBy = creator.id;
          }
        }

        let updatedBy = null;
        if (v1Account.updated_by) {
          const updater = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Account.updated_by) },
          });
          if (updater) {
            updatedBy = updater.id;
          }
        }

        // Create account in V2
        await this.prisma.account.create({
          data: {
            legacy_id: BigInt(v1Account.id),
            code: v1Account.code || `ACC_${v1Account.id}`,
            name: v1Account.name || 'Unnamed Account',
            type: v1Account.type || 'tenant',
            status: v1Account.status || 'active',
            parent_id: parentId,
            created_at: v1Account.created_at ? new Date(v1Account.created_at) : new Date(),
            updated_at: v1Account.updated_at ? new Date(v1Account.updated_at) : new Date(),
            created_by: createdBy,
            updated_by: updatedBy,
          },
        });

        this.logger.log(`Migrated account ${v1Account.id}`);
        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate account ${v1Account.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} accounts, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Migrate users from V1 to V2
   * Preserves tokens for authentication continuity
   */
  async migrateUsers(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM users');
    const users = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1User of users) {
      try {
        // Check if already migrated
        const existing = await this.prisma.user.findUnique({
          where: { legacy_id: BigInt(v1User.id) },
        });
        if (existing) {
          this.logger.log(`User ${v1User.id} already migrated, skipping`);
          success++;
          continue;
        }

        // Map default_account_id
        let defaultAccountId = null;
        if (v1User.default_account_id) {
          const account = await this.prisma.account.findUnique({
            where: { legacy_id: BigInt(v1User.default_account_id) },
          });
          if (account) {
            defaultAccountId = account.id;
          }
        }

        // Preserve password hash
        let passwordHash = v1User.password_hash;
        if (!passwordHash) {
          // Set default password if missing
          passwordHash = await bcrypt.hash('Pass123!', 10);
        }

        const rawName = (v1User.name || `User ${v1User.id}`).trim();
        const { first_name: migratedFirst, last_name: migratedLast } = splitIntoFirstLast(rawName);
        const migratedDisplay = composeUserFullName(migratedFirst, migratedLast) || rawName;

        // Create user in V2
        await this.prisma.user.create({
          data: {
            legacy_id: BigInt(v1User.id),
            code: v1User.code || null,
            first_name: migratedFirst,
            last_name: migratedLast,
            name: migratedDisplay,
            email: v1User.email || null,
            phone: v1User.phone || null,
            password_hash: passwordHash,
            token: v1User.token || null, // Preserve token for authentication
            account_type: v1User.account_type || 'mcc',
            status: v1User.status || 'active',
            default_account_id: defaultAccountId,
            kyc_status: v1User.kyc_status || null,
            kyc_verified_at: v1User.kyc_verified_at ? new Date(v1User.kyc_verified_at) : null,
            created_at: v1User.created_at ? new Date(v1User.created_at) : new Date(),
            updated_at: v1User.updated_at ? new Date(v1User.updated_at) : new Date(),
          },
        });

        this.logger.log(`Migrated user ${v1User.id}`);
        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate user ${v1User.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} users, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Migrate user_accounts relationships
   */
  async migrateUserAccounts(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM user_accounts');
    const userAccounts = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1UA of userAccounts) {
      try {
        // Check if already migrated
        const existing = await this.prisma.userAccount.findUnique({
          where: { legacy_id: BigInt(v1UA.id) },
        });
        if (existing) {
          success++;
          continue;
        }

        // Map user_id and account_id
        const user = await this.prisma.user.findUnique({
          where: { legacy_id: BigInt(v1UA.user_id) },
        });
        const account = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1UA.account_id) },
        });

        if (!user || !account) {
          this.logger.warn(`User or account not found for user_account ${v1UA.id}`);
          failed++;
          continue;
        }

        // Parse permissions JSON
        let permissions = null;
        if (v1UA.permissions) {
          try {
            permissions = typeof v1UA.permissions === 'string' 
              ? JSON.parse(v1UA.permissions) 
              : v1UA.permissions;
          } catch {
            permissions = null;
          }
        }

        await this.prisma.userAccount.create({
          data: {
            legacy_id: BigInt(v1UA.id),
            user_id: user.id,
            account_id: account.id,
            role: v1UA.role || 'viewer',
            permissions: permissions ? JSON.stringify(permissions) : null,
            status: v1UA.status || 'active',
            created_at: v1UA.created_at ? new Date(v1UA.created_at) : new Date(),
          },
        });

        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate user_account ${v1UA.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} user_accounts, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Migrate suppliers_customers relationships
   */
  async migrateSuppliersCustomers(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM suppliers_customers');
    const relationships = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1Rel of relationships) {
      try {
        const existing = await this.prisma.supplierCustomer.findUnique({
          where: { legacy_id: BigInt(v1Rel.id) },
        });
        if (existing) {
          success++;
          continue;
        }

        const supplier = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Rel.supplier_account_id) },
        });
        const customer = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Rel.customer_account_id) },
        });

        if (!supplier || !customer) {
          this.logger.warn(`Missing supplier/customer for supplier_customer ${v1Rel.id}`);
          failed++;
          continue;
        }

        // Map created_by and updated_by to user UUIDs
        let createdBy = null;
        if (v1Rel.created_by) {
          const creator = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Rel.created_by) },
          });
          if (creator) {
            createdBy = creator.id;
          }
        }

        let updatedBy = null;
        if (v1Rel.updated_by) {
          const updater = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Rel.updated_by) },
          });
          if (updater) {
            updatedBy = updater.id;
          }
        }

        await this.prisma.supplierCustomer.create({
          data: {
            legacy_id: BigInt(v1Rel.id),
            supplier_account_id: supplier.id,
            customer_account_id: customer.id,
            price_per_liter: v1Rel.price_per_liter ? parseFloat(v1Rel.price_per_liter.toString()) : null,
            relationship_status: (v1Rel.relationship_status || 'active') as any,
            created_at: v1Rel.created_at ? new Date(v1Rel.created_at) : new Date(),
            created_by: createdBy,
            updated_by: updatedBy,
          },
        });

        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate supplier_customer ${v1Rel.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} suppliers_customers, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Migrate milk_sales (collections)
   */
  async migrateMilkSales(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM milk_sales');
    const sales = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1Sale of sales) {
      try {
        const existing = await this.prisma.milkSale.findUnique({
          where: { legacy_id: v1Sale.id },
        });
        if (existing) {
          success++;
          continue;
        }

        const supplier = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Sale.supplier_account_id) },
        });
        const customer = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Sale.customer_account_id) },
        });
        const recordedBy = await this.prisma.user.findUnique({
          where: { legacy_id: BigInt(v1Sale.recorded_by) },
        });

        if (!supplier || !customer || !recordedBy) {
          this.logger.warn(`Missing supplier/customer/recordedBy for milk_sale ${v1Sale.id}`);
          failed++;
          continue;
        }

        // Map created_by and updated_by to user UUIDs
        let createdBy = null;
        if (v1Sale.created_by) {
          const creator = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Sale.created_by) },
          });
          if (creator) {
            createdBy = creator.id;
          } else {
            this.logger.warn(`User with legacy_id ${v1Sale.created_by} not found for milk_sale ${v1Sale.id} created_by`);
          }
        }

        let updatedBy = null;
        if (v1Sale.updated_by) {
          const updater = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Sale.updated_by) },
          });
          if (updater) {
            updatedBy = updater.id;
          } else {
            this.logger.warn(`User with legacy_id ${v1Sale.updated_by} not found for milk_sale ${v1Sale.id} updated_by`);
          }
        }

        await this.prisma.milkSale.create({
          data: {
            legacy_id: parseInt(v1Sale.id.toString()),
            supplier_account_id: supplier.id,
            customer_account_id: customer.id,
            quantity: parseFloat(v1Sale.quantity.toString()),
            unit_price: parseFloat(v1Sale.unit_price.toString()),
            status: v1Sale.status || 'pending',
            sale_at: v1Sale.sale_at ? new Date(v1Sale.sale_at) : new Date(),
            notes: v1Sale.notes || null,
            recorded_by: recordedBy.id,
            created_at: v1Sale.created_at ? new Date(v1Sale.created_at) : new Date(),
            updated_at: v1Sale.updated_at ? new Date(v1Sale.updated_at) : new Date(),
            created_by: createdBy,
            updated_by: updatedBy,
          },
        });

        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate milk_sale ${v1Sale.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} milk_sales, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Migrate wallets
   */
  async migrateWallets(): Promise<{ success: number; failed: number }> {
    if (!this.v1Connection) {
      throw new Error('V1 database not connected');
    }

    const [rows] = await this.v1Connection.execute('SELECT * FROM wallets');
    const wallets = rows as any[];

    let success = 0;
    let failed = 0;

    for (const v1Wallet of wallets) {
      try {
        const existing = await this.prisma.wallet.findUnique({
          where: { legacy_id: BigInt(v1Wallet.id) },
        });
        if (existing) {
          success++;
          continue;
        }

        const account = await this.prisma.account.findUnique({
          where: { legacy_id: BigInt(v1Wallet.account_id) },
        });

        if (!account) {
          this.logger.warn(`Missing account for wallet ${v1Wallet.id}`);
          failed++;
          continue;
        }

        // Map created_by and updated_by to user UUIDs
        let createdBy = null;
        if (v1Wallet.created_by) {
          const creator = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Wallet.created_by) },
          });
          if (creator) {
            createdBy = creator.id;
          }
        }

        let updatedBy = null;
        if (v1Wallet.updated_by) {
          const updater = await this.prisma.user.findUnique({
            where: { legacy_id: BigInt(v1Wallet.updated_by) },
          });
          if (updater) {
            updatedBy = updater.id;
          }
        }

        await this.prisma.wallet.create({
          data: {
            legacy_id: BigInt(v1Wallet.id),
            account_id: account.id,
            type: (v1Wallet.wallet_type || 'regular') as any,
            balance: parseFloat(v1Wallet.balance.toString()),
            status: (v1Wallet.status || 'active') as any,
            is_joint: v1Wallet.is_joint === 1 || v1Wallet.is_joint === true,
            created_at: v1Wallet.created_at ? new Date(v1Wallet.created_at) : new Date(),
            updated_at: v1Wallet.updated_at ? new Date(v1Wallet.updated_at) : new Date(),
            created_by: createdBy,
            updated_by: updatedBy,
          },
        });

        success++;
      } catch (error: any) {
        this.logger.error(`Failed to migrate wallet ${v1Wallet.id}:`, error.message);
        failed++;
      }
    }

    this.logger.log(`Migrated ${success} wallets, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Run complete migration
   */
  async runMigration(v1Config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): Promise<{
    accounts: { success: number; failed: number };
    users: { success: number; failed: number };
    userAccounts: { success: number; failed: number };
    suppliersCustomers: { success: number; failed: number };
    milkSales: { success: number; failed: number };
    wallets: { success: number; failed: number };
  }> {
    this.logger.log('Starting V1 → V2 migration...');

    try {
      await this.connectV1(v1Config);

      // Priority order: Accounts and Users first (dependencies), then Milk Sales (priority), then others
      this.logger.log('Step 1/6: Migrating accounts...');
      const accounts = await this.migrateAccounts();
      
      this.logger.log('Step 2/6: Migrating users...');
      const users = await this.migrateUsers();
      
      this.logger.log('Step 3/6: Migrating user accounts...');
      const userAccounts = await this.migrateUserAccounts();
      
      this.logger.log('Step 4/6: Migrating suppliers-customers...');
      const suppliersCustomers = await this.migrateSuppliersCustomers();
      
      this.logger.log('Step 5/6: Migrating milk sales (PRIORITY)...');
      const milkSales = await this.migrateMilkSales();
      
      this.logger.log('Step 6/6: Migrating wallets...');
      const wallets = await this.migrateWallets();

      this.logger.log('Migration completed!');
      return { accounts, users, userAccounts, suppliersCustomers, milkSales, wallets };
    } finally {
      await this.disconnectV1();
    }
  }
}

