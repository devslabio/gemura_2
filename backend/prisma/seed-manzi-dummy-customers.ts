import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from './user-name-shared';

const prisma = new PrismaClient();

const SUPPLIER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const SUPPLIER_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const PRICE = 400;

const hex = () => randomBytes(3).toString('hex').toUpperCase();

/** name,phone per line — 60 Rwandan-style dummy buyers for Manzi (250788300001–060). */
const CUSTOMERS = `
Jean Pierre Mugisha,250788300001
Marie Therese Mukamana,250788300002
Patrick Ndayisaba,250788300003
Jeanne Umutoni,250788300004
Eric Nshimiyimana,250788300005
Sandrine Ishimwe,250788300006
Claude Habineza,250788300007
Pacifique Nyiramana,250788300008
Olivier Ntwari,250788300009
Chantal Mukeshimana,250788300010
Dieudonne Bizimana,250788300011
Angelique Uwera,250788300012
Tharcisse Ntambara,250788300013
Joseph Nkurikiye,250788300014
Consolee Mukamazimpaka,250788300015
Daniel Ndagijimana,250788300016
Vestine Uwimbabazi,250788300017
Samuel Munyaneza,250788300018
Delphine Mutoni,250788300019
Albert Nkusi,250788300020
Adeline Mukantagara,250788300021
Benjamin Nsanzimana,250788300022
Charlotte Uwimana,250788300023
Dominique Nkurunziza,250788300024
Esther Mukamana,250788300025
Fabrice Ndayishimiye,250788300026
Grace Ishimwe,250788300027
Herve Ntwari,250788300028
Immaculee Mukeshimana,250788300029
Jean Baptiste Bizimana,250788300030
Kelly Uwera,250788300031
Laetitia Ntambara,250788300032
Marc Nkurikiye,250788300033
Nadine Mukamazimpaka,250788300034
Oscar Ndagijimana,250788300035
Prisca Uwimbabazi,250788300036
Quentin Munyaneza,250788300037
Rebecca Mutoni,250788300038
Steven Nkusi,250788300039
Therese Mukantagara,250788300040
Uwineza Ange,250788300041
Valentine Nsanzimana,250788300042
William Uwimana,250788300043
Xavera Nkurunziza,250788300044
Yvette Mukamana,250788300045
Zacharie Ndayishimiye,250788300046
Aline Ishimwe,250788300047
Bosco Ntwari,250788300048
Celine Mukeshimana,250788300049
David Bizimana,250788300050
Edith Uwera,250788300051
Frank Ntambara,250788300052
Gisele Nkurikiye,250788300053
Henri Mukamazimpaka,250788300054
Irene Ndagijimana,250788300055
James Uwimbabazi,250788300056
Karine Munyaneza,250788300057
Lambert Mutoni,250788300058
Mireille Nkusi,250788300059
Noel Habimana,250788300060
`
  .trim()
  .split('\n')
  .map((line) => {
    const [name, phone] = line.split(',');
    return { name: name.trim(), phone: phone.replace(/\D/g, '') };
  });

async function newAccountForCustomer(
  supplierId: string,
  userId: string,
  name: string,
  setDefault: boolean,
) {
  const account = await prisma.account.create({
    data: {
      code: `A_${hex()}`,
      name,
      type: 'tenant',
      status: 'active',
      created_by: supplierId,
    },
  });
  await prisma.userAccount.create({
    data: {
      user_id: userId,
      account_id: account.id,
      role: 'customer',
      status: 'active',
      created_by: supplierId,
    },
  });
  await prisma.wallet.create({
    data: {
      code: `W_${hex()}`,
      account_id: account.id,
      type: 'regular',
      is_default: true,
      balance: 0,
      currency: 'RWF',
      status: 'active',
      created_by: supplierId,
    },
  });
  if (setDefault) {
    await prisma.user.update({
      where: { id: userId },
      data: { default_account_id: account.id },
    });
  }
  return account.id;
}

async function resolveCustomerAccountId(
  supplierId: string,
  pwdHash: string,
  name: string,
  phone: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { phone },
    include: {
      user_accounts: { where: { status: 'active' }, take: 1 },
    },
  });

  if (existing) {
    const { first_name: fn, last_name: ln } = splitIntoFirstLast(name);
    const display = composeUserFullName(fn, ln) || name.trim();
    await prisma.user.update({
      where: { id: existing.id },
      data: { first_name: fn, last_name: ln, name: display },
    });
    const ua = existing.user_accounts[0];
    if (ua) {
      await prisma.account.update({ where: { id: ua.account_id }, data: { name } });
      return ua.account_id;
    }
    return newAccountForCustomer(supplierId, existing.id, name, !existing.default_account_id);
  }

  const { first_name: fn, last_name: ln } = splitIntoFirstLast(name);
  const display = composeUserFullName(fn, ln) || name.trim();

  const user = await prisma.user.create({
    data: {
      code: `U_${hex()}`,
      first_name: fn,
      last_name: ln,
      name: display,
      phone,
      email: `${phone}+cust@gemura.local`,
      password_hash: pwdHash,
      token: randomBytes(32).toString('hex'),
      status: 'active',
      account_type: 'customer',
      created_by: supplierId,
    },
  });
  return newAccountForCustomer(supplierId, user.id, name, true);
}

async function main() {
  const [account, user] = await Promise.all([
    prisma.account.findUnique({ where: { code: SUPPLIER_ACCOUNT } }),
    prisma.user.findFirst({ where: { code: SUPPLIER_USER } }),
  ]);
  if (!account || !user) {
    throw new Error(`Need ${SUPPLIER_ACCOUNT} + ${SUPPLIER_USER} (run seed:kwezi-test-manzi first).`);
  }

  const pwdHash = await bcrypt.hash('Pass123!', 10);

  for (const { name, phone } of CUSTOMERS) {
    const customerAccountId = await resolveCustomerAccountId(user.id, pwdHash, name, phone);
    await prisma.supplierCustomer.upsert({
      where: {
        supplier_account_id_customer_account_id: {
          supplier_account_id: account.id,
          customer_account_id: customerAccountId,
        },
      },
      create: {
        supplier_account_id: account.id,
        customer_account_id: customerAccountId,
        price_per_liter: PRICE,
        relationship_status: 'active',
        created_by: user.id,
      },
      update: {
        price_per_liter: PRICE,
        relationship_status: 'active',
        updated_by: user.id,
      },
    });
  }

  console.log(`${CUSTOMERS.length} customers → ${SUPPLIER_ACCOUNT} @ ${PRICE} RWF/L`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
