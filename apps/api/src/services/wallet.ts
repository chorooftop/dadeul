import { and, eq, gte, sum } from 'drizzle-orm'
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

  // 일일 적립은 행 수가 아니라 금액 합 — 상한 판정(votes.ts)과 단위를 일치시킨다
  const [earned] = await db
    .select({ total: sum(creditLedger.amount) })
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
    dailyEarned: Number(earned?.total ?? 0),
    dailyCap,
  }
}
