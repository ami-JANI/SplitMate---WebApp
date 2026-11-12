import { netBalances, settle } from '../lib/settlement';
import { firstName } from '../lib/avatars';
import { formatTaka } from '../lib/money';
import { memberName, type Expense, type Hangout } from '../lib/types';
import { TwoToneTitle } from './ui';

/** Payments that would settle everything not yet turned into bills, the viewer's own first. */
export function LiveSplitCard({ hangout, expenses, me }: { hangout: Hangout; expenses: Expense[]; me: string }) {
  const open = expenses.filter((e) => !hangout.settledDays.includes(e.dayKey));
  const transfers = settle(open, hangout.memberIDs);
  const balances = netBalances(open, hangout.memberIDs);
  const name = (id: string) => (id === me ? 'You' : firstName(memberName(hangout, id)));

  const iOwe = transfers.filter((t) => t.fromID === me);
  const owesMe = transfers.filter((t) => t.toID === me);
  const others = transfers.filter((t) => t.fromID !== me && t.toID !== me);
  const order = [me, ...hangout.memberIDs.filter((id) => id !== me)].filter((id) => hangout.memberIDs.includes(id));
  const tour = hangout.kind === 'tour';

  return (
    <section className="card card-big stack gap-14" style={{ background: 'color-mix(in srgb, var(--light-yellow) 60%, var(--paper))' }} aria-label="Live split">
      <TwoToneTitle light={tour ? "Today's" : 'Live'} bold="split" size="var(--t-title2)" />

      {iOwe.length > 0 && (
        <Group title="You owe">
          {iOwe.map((t) => (
            <Line key={t.toID} left={name(t.toID)} amount={t.amountCents} color="var(--deep-purple)" />
          ))}
        </Group>
      )}
      {owesMe.length > 0 && (
        <Group title="Owes you">
          {owesMe.map((t) => (
            <Line key={t.fromID} left={name(t.fromID)} amount={t.amountCents} color="var(--sage)" />
          ))}
        </Group>
      )}
      {iOwe.length === 0 && owesMe.length === 0 && <p className="w7 t-sub">You're even. Nothing to pay or collect.</p>}
      {others.length > 0 && (
        <Group title="Between the others">
          {others.map((t) => (
            <Line key={`${t.fromID}-${t.toID}`} left={`${name(t.fromID)} → ${name(t.toID)}`} amount={t.amountCents} />
          ))}
        </Group>
      )}
      <p className="t-cap muted w7">{tour ? 'Becomes bills at the end of the day.' : 'Becomes bills when the hangout is ended.'}</p>

      <Group title="Balances">
        {order.map((id) => {
          const b = balances.get(id) ?? 0;
          return (
            <div key={id} className="row gap-8 t-sub">
              <span className={`grow ellipsis ${id === me ? 'w8' : 'w6'}`}>{name(id)}</span>
              {b > 0 ? (
                <span className="w8" style={{ color: 'var(--sage)' }}>gets {formatTaka(b)}</span>
              ) : b < 0 ? (
                <span className="w8" style={{ color: 'var(--deep-purple)' }}>owes {formatTaka(-b)}</span>
              ) : (
                <span className="muted w7">even</span>
              )}
            </div>
          );
        })}
      </Group>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack gap-6">
      <span className="label muted">{title}</span>
      {children}
    </div>
  );
}

function Line({ left, amount, color }: { left: string; amount: number; color?: string }) {
  return (
    <div className="row gap-8 t-sub">
      <span className="grow w7 ellipsis">{left}</span>
      <span className="num t-callout" style={{ color }}>{formatTaka(amount)}</span>
    </div>
  );
}
