/** Inline validation for the onboarding “review” step — mirrors CreateSupplierForm + backend rules. */

const RW_PHONE = /^250[0-9]{9}$/;
export const RW_NID_REGEX = /^1[0-9]{15}$/;
const RW_NID = RW_NID_REGEX;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRwandaPhoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('250')) return d;
  if (d.length === 10 && d.startsWith('0')) return `250${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('7')) return `250${d}`;
  return d;
}

/** National ID validation (16 digits, leading 1) — strips non-digits first. */
export function isRwandanNationalId(value: string): boolean {
  const d = value.replace(/\D/g, '').slice(0, 16);
  return RW_NID.test(d);
}

export function isRwandaMobileLine(raw: string): boolean {
  return RW_PHONE.test(normalizeRwandaPhoneDigits(raw));
}

export function formatLocationLine(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(', ');
}

export interface OnboardingReviewInput {
  name: string;
  phoneRaw: string;
  emailRaw: string;
  password: string;
  password2: string;
  pricePerLiterRaw: string;
  nidDigits: string;
  addressRaw: string;
  bankNameRaw: string;
  bankAccountRaw: string;
}

export interface OnboardingReviewParsed {
  name: string;
  phone: string;
  email?: string;
  password: string;
  price_per_liter: number;
  nid: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
}

/**
 * Validates review-step fields for registration. Returns a map fieldKey → message (stable keys for inputs).
 */
export function validateOnboardingReview(input: OnboardingReviewInput): {
  errors: Record<string, string>;
  parsed: OnboardingReviewParsed | null;
} {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizeRwandaPhoneDigits(input.phoneRaw);
  const emailT = input.emailRaw.trim().toLowerCase();
  const address = input.addressRaw.trim();
  const bankName = input.bankNameRaw.trim();
  const bankAcct = input.bankAccountRaw.trim();

  if (!name) errors.regName = 'Full name is required.';
  if (!RW_PHONE.test(phone)) {
    errors.regPhone = 'Phone must be Rwandan format (250XXXXXXXXX). You can paste 078… and we normalize it.';
  }
  if (emailT && !SIMPLE_EMAIL.test(emailT)) errors.regEmail = 'Invalid email format.';
  if (input.password.length < 6) errors.regPassword = 'Password must be at least 6 characters.';
  if (input.password !== input.password2) errors.regPassword2 = 'Passwords do not match.';

  const price = Number.parseFloat(input.pricePerLiterRaw.replace(',', '.'));
  if (!Number.isFinite(price) || price <= 0) {
    errors.regPricePerLiter = 'Price per liter must be a positive number (RWF).';
  }

  const nid = input.nidDigits.replace(/\D/g, '').slice(0, 16);
  if (!RW_NID.test(nid)) {
    errors.regNid = 'National ID must be exactly 16 digits and start with 1.';
  }

  if (address.length > 500) errors.regAddress = 'Address is too long (max 500 characters).';

  if (bankName.length > 120) errors.regBankName = 'Bank name is too long (max 120 characters).';

  if (bankAcct) {
    if (bankAcct.length > 64) errors.regBankAccount = 'Bank account number is too long.';
    else if (bankAcct.length < 5) errors.regBankAccount = 'Bank account number looks too short.';
  }

  const parsed: OnboardingReviewParsed | null =
    Object.keys(errors).length === 0
      ? {
          name,
          phone,
          password: input.password,
          price_per_liter: price,
          nid,
          ...(emailT ? { email: emailT } : {}),
          ...(address ? { address } : {}),
          ...(bankName ? { bank_name: bankName } : {}),
          ...(bankAcct ? { bank_account_number: bankAcct } : {}),
        }
      : null;

  return { errors, parsed };
}
