import { and, count, eq, gte } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, creditLedger } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { kstDayStart } from '../domain/time.js'

export interface WalletView {
  balance: number
  dailyEarned: number
  dailyCap: number
}

export async function getWallet(
  db: Db,
  accountId: string,
  now: Date,
  dailyCap: number,
): Promise<WalletView> {
  const [account] = await db
    .select({ creditBalance: accounts.creditBalance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  if (!account) {
    throw new AppError('UNAUTHORIZED', 401, `account not found: ${accountId}`)
  }

  const [earned] = await db
    .select({ grants: count() })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.accountId, accountId),
        eq(creditLedger.reason, 'weather_vote'),
        gte(creditLedger.createdAt, kstDayStart(now)),
      ),
    )

  return {
    balance: account.creditBalance,
    dailyEarned: earned?.grants ?? 0,
    dailyCap,
  }
}
