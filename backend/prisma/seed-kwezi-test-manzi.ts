import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Same shape as AuthService.register: U_XXX / A_XXX / W_XXX (3 chars after underscore).
 * Defaults: Manzi Fabrice → MFZ. Override via MANZI_USER_CODE, MANZI_ACCOUNT_CODE, MANZI_WALLET_CODE.
 */
const USER_CODE = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const ACCOUNT_CODE = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const WALLET_CODE = process.env.MANZI_WALLET_CODE ?? 'W_MFZ';

const DISPLAY_NAME = 'Manzi Fabrice';
const PHONE = '250788000000';
const EMAIL = 'manzi.fabrice+kwezi-test@gemura.local';

async function main() {
  const hashedPassword = await bcrypt.hash('Pass123!', 10);
  const token = `token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const byPhone = await prisma.user.findUnique({ where: { phone: PHONE } });
  let account;
  let user;

  if (byPhone) {
    if (!byPhone.default_account_id) {
      throw new Error('User has no default account; create/link account first.');
    }

    const accOther = await prisma.account.findUnique({ where: { code: ACCOUNT_CODE } });
    if (accOther && accOther.id !== byPhone.default_account_id) {
      throw new Error(`Account code ${ACCOUNT_CODE} is already taken.`);
    }
    const usrOther = await prisma.user.findUnique({ where: { code: USER_CODE } });
    if (usrOther && usrOther.id !== byPhone.id) {
      throw new Error(`User code ${USER_CODE} is already taken.`);
    }

    account = await prisma.account.update({
      where: { id: byPhone.default_account_id },
      data: {
        code: ACCOUNT_CODE,
        name: `${DISPLAY_NAME} (test)`,
        status: 'active',
      },
    });
    user = await prisma.user.update({
      where: { id: byPhone.id },
      data: {
        code: USER_CODE,
        name: DISPLAY_NAME,
        email: EMAIL,
        password_hash: hashedPassword,
        token,
        status: 'active',
      },
    });

    const walletOther = await prisma.wallet.findUnique({ where: { code: WALLET_CODE } });
    const defaultWallet = await prisma.wallet.findFirst({
      where: { account_id: account.id, is_default: true },
    });
    if (defaultWallet) {
      if (walletOther && walletOther.id !== defaultWallet.id) {
        throw new Error(`Wallet code ${WALLET_CODE} is already taken.`);
      }
      if (defaultWallet.code !== WALLET_CODE) {
        await prisma.wallet.update({
          where: { id: defaultWallet.id },
          data: { code: WALLET_CODE },
        });
      }
    } else {
      if (walletOther) {
        throw new Error(`Wallet code ${WALLET_CODE} is already taken.`);
      }
      await prisma.wallet.create({
        data: {
          code: WALLET_CODE,
          account_id: account.id,
          type: 'regular',
          is_joint: false,
          is_default: true,
          balance: 0,
          currency: 'RWF',
          status: 'active',
        },
      });
    }
  } else {
    const occupantUser = await prisma.user.findUnique({ where: { code: USER_CODE } });
    if (occupantUser && occupantUser.phone !== PHONE) {
      throw new Error(
        `User code ${USER_CODE} is already in use; set MANZI_USER_CODE to a free U_XXX value.`,
      );
    }
    account = await prisma.account.upsert({
      where: { code: ACCOUNT_CODE },
      update: { name: `${DISPLAY_NAME} (test)`, status: 'active' },
      create: {
        code: ACCOUNT_CODE,
        name: `${DISPLAY_NAME} (test)`,
        type: 'tenant',
        status: 'active',
      },
    });
    user = await prisma.user.upsert({
      where: { code: USER_CODE },
      update: {
        name: DISPLAY_NAME,
        phone: PHONE,
        email: EMAIL,
        default_account_id: account.id,
        password_hash: hashedPassword,
        token,
        status: 'active',
      },
      create: {
        code: USER_CODE,
        name: DISPLAY_NAME,
        phone: PHONE,
        email: EMAIL,
        password_hash: hashedPassword,
        token,
        account_type: 'farmer',
        status: 'active',
        default_account_id: account.id,
      },
    });
    await prisma.wallet.upsert({
      where: { code: WALLET_CODE },
      update: {},
      create: {
        code: WALLET_CODE,
        account_id: account.id,
        type: 'regular',
        is_joint: false,
        is_default: true,
        balance: 0,
        currency: 'RWF',
        status: 'active',
      },
    });
  }

  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: { user_id: user.id, account_id: account.id },
    },
    update: {
      role: 'system_admin',
      status: 'active',
      permissions: { can_manage: true, can_view: true, can_edit: true },
    },
    create: {
      user_id: user.id,
      account_id: account.id,
      role: 'system_admin',
      permissions: { can_manage: true, can_view: true, can_edit: true },
      status: 'active',
    },
  });

  console.log(`User ${user.code} | Account ${account.code} | Wallet ${WALLET_CODE}`);
  console.log(`Login: ${PHONE} / Pass123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
