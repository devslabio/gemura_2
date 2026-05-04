import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { composeUserFullName, splitIntoFirstLast } from './user-name-shared';

const prisma = new PrismaClient();

/** Manzi’s account (buyer / collection center). */
const BUYER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const ACTING_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const PRICE = 400;

const hex = () => randomBytes(3).toString('hex').toUpperCase();

/** Farmers selling to Manzi — 250788301001–060. */
const SUPPLIERS = `
Theogene Dusabe,250788301001
Consolee Nyirahabimana,250788301002
Innocent Nkurunziza,250788301003
Florence Mukantwari,250788301004
Aimable Twagirayezu,250788301005
Gaudence Imanishimwe,250788301006
Aloys Nsengimana,250788301007
Dative Uwamariya,250788301008
Felicien Kamanzi,250788301009
Annonciata Mukamazimpaka,250788301010
Emmanuel Munyankindi,250788301011
Olive Nyirasafari,250788301012
Prosper Ndayiringiye,250788301013
Mariele Irakoze,250788301014
Clement Bigirimana,250788301015
Xavera Uzabakiriho,250788301016
Valens Niyonkuru,250788301017
Speciose Ingabire,250788301018
Leon Ntawukuriryayo,250788301019
Yves Rukundo,250788301020
Augustin Ndayisenga,250788301021
Beatrice Mukarugwiza,250788301022
Celestin Nsengiyumva,250788301023
Dorothee Uwanyirigira,250788301024
Evariste Nkundabagenzi,250788301025
Fabiola Mukasine,250788301026
Gaspard Nteziryayo,250788301027
Helene Uwimbabazi,250788301028
Ignace Nsanzumuhire,250788301029
Jeannette Mukamurego,250788301030
Kenneth Ndayambaje,250788301031
Liliane Uwimana,250788301032
Moise Nkurikiye,250788301033
Nathalie Mukamana,250788301034
Oscar Ndayishimiye,250788301035
Philomene Ishimwe,250788301036
Richard Ntwari,250788301037
Solange Mukeshimana,250788301038
Thomas Bizimana,250788301039
Uwineza Claudine,250788301040
Victor Nsengimana,250788301041
Winifred Uwera,250788301042
Xavier Ntambara,250788301043
Yolande Nkurikiye,250788301044
Zephaniah Mukamazimpaka,250788301045
Adelphine Ndagijimana,250788301046
Blaise Uwimbabazi,250788301047
Chantal Munyaneza,250788301048
Didier Mutoni,250788301049
Eugenie Nkusi,250788301050
Felix Habimana,250788301051
Gertrude Mukantagara,250788301052
Hubert Nsanzimana,250788301053
Ines Uwimana,250788301054
Jacques Nkurunziza,250788301055
Ketty Mukamana,250788301056
Lambert Ndayishimiye,250788301057
Marceline Ishimwe,250788301058
Norbert Ntwari,250788301059
Odette Mukeshimana,250788301060
`
  .trim()
  .split('\n')
  .map((line) => {
    const i = line.lastIndexOf(',');
    const name = line.slice(0, i).trim();
    const phone = line.slice(i + 1).replace(/\D/g, '');
    return { name, phone };
  });

async function newAccountForSupplier(
  createdBy: string,
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
      created_by: createdBy,
    },
  });
  await prisma.userAccount.create({
    data: {
      user_id: userId,
      account_id: account.id,
      role: 'supplier',
      status: 'active',
      created_by: createdBy,
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
      created_by: createdBy,
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

async function resolveSupplierAccountId(
  createdBy: string,
  pwdHash: string,
  name: string,
  phone: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { phone },
    include: { user_accounts: { where: { status: 'active' }, take: 1 } },
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
    return newAccountForSupplier(createdBy, existing.id, name, !existing.default_account_id);
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
      email: `${phone}+supp@gemura.local`,
      password_hash: pwdHash,
      token: randomBytes(32).toString('hex'),
      status: 'active',
      account_type: 'supplier',
      created_by: createdBy,
    },
  });
  return newAccountForSupplier(createdBy, user.id, name, true);
}

async function main() {
  const [buyerAccount, actor] = await Promise.all([
    prisma.account.findUnique({ where: { code: BUYER_ACCOUNT } }),
    prisma.user.findFirst({ where: { code: ACTING_USER } }),
  ]);
  if (!buyerAccount || !actor) {
    throw new Error(`Need ${BUYER_ACCOUNT} + ${ACTING_USER} (run seed:kwezi-test-manzi first).`);
  }

  const pwdHash = await bcrypt.hash('Pass123!', 10);

  for (const { name, phone } of SUPPLIERS) {
    const supplierAccountId = await resolveSupplierAccountId(actor.id, pwdHash, name, phone);
    await prisma.supplierCustomer.upsert({
      where: {
        supplier_account_id_customer_account_id: {
          supplier_account_id: supplierAccountId,
          customer_account_id: buyerAccount.id,
        },
      },
      create: {
        supplier_account_id: supplierAccountId,
        customer_account_id: buyerAccount.id,
        price_per_liter: PRICE,
        relationship_status: 'active',
        created_by: actor.id,
      },
      update: {
        price_per_liter: PRICE,
        relationship_status: 'active',
        updated_by: actor.id,
      },
    });
  }

  console.log(`${SUPPLIERS.length} suppliers → ${BUYER_ACCOUNT} (buyer) @ ${PRICE} RWF/L`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
