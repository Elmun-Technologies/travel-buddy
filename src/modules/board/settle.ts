// Who owes whom. Pure, so it is unit-tested without a database.

export type Expense = { paidBy: string; amount: number; splitAmong: string[] };
export type Payment = { from: string; to: string; amount: number };

/** Net balance per person (minor units): positive = others owe them. */
export function balances(expenses: Expense[], payments: Payment[]) {
  const b = new Map<string, number>();
  const add = (u: string, v: number) => b.set(u, (b.get(u) ?? 0) + v);
  for (const e of expenses) {
    const people = [...e.splitAmong].sort(); // stable remainder: first people pay 1 cent more
    if (!people.length) continue;
    const share = Math.floor(e.amount / people.length);
    let rest = e.amount - share * people.length;
    add(e.paidBy, e.amount);
    for (const u of people) add(u, -(share + (rest-- > 0 ? 1 : 0)));
  }
  for (const p of payments) {
    add(p.from, p.amount);
    add(p.to, -p.amount);
  }
  return b;
}

/** Fewest-ish transfers: biggest debtor pays biggest creditor, repeat. */
export function settle(expenses: Expense[], payments: Payment[]): Payment[] {
  const all = [...balances(expenses, payments)];
  const debt = all.filter(([, v]) => v < 0).map(([u, v]) => ({ u, v: -v }));
  const cred = all.filter(([, v]) => v > 0).map(([u, v]) => ({ u, v }));
  const out: Payment[] = [];
  const byV = (a: { v: number; u: string }, b: { v: number; u: string }) =>
    b.v - a.v || a.u.localeCompare(b.u);
  while (debt.length && cred.length) {
    debt.sort(byV);
    cred.sort(byV);
    const d = debt[0];
    const c = cred[0];
    const amount = Math.min(d.v, c.v);
    out.push({ from: d.u, to: c.u, amount });
    d.v -= amount;
    c.v -= amount;
    if (!d.v) debt.shift();
    if (!c.v) cred.shift();
  }
  return out;
}
