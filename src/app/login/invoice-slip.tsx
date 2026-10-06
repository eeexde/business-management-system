/**
 * A miniature invoice from the demo company, with a PAID stamp that lands on page load.
 * Purely illustrative (aria-hidden): it shows what the product does rather than describing it.
 */
const LINES = [
  { item: "Copy paper, A4, 10 reams", qty: 6, price: 4825 },
  { item: "Packing tape, 48 mm", qty: 24, price: 360 },
  { item: "Shelving installation", qty: 1, price: 12000 },
];

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function InvoiceSlip() {
  const subtotal = LINES.reduce((s, l) => s + l.qty * l.price, 0);
  const tax = Math.round(subtotal * 0.085);
  return (
    <div aria-hidden className="relative w-full max-w-sm -rotate-2 rounded-lg bg-white p-6 text-[#17212b] shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold">INV-0142</p>
          <p className="text-xs text-[#5d6a76]">Brightline Dental, due Oct 30</p>
        </div>
        <p className="text-right text-xs text-[#5d6a76]">
          Northwind
          <br />
          Supply Co.
        </p>
      </div>

      <table className="mt-5 w-full text-xs">
        <tbody className="divide-y divide-[#dce1e5]">
          {LINES.map((l) => (
            <tr key={l.item}>
              <td className="py-2 pr-2">{l.item}</td>
              <td className="py-2 pr-2 text-right text-[#5d6a76]">{l.qty}</td>
              <td className="py-2 text-right tabular-nums">{usd(l.qty * l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 border-t-2 border-[#17212b] pt-3 text-xs">
        <div className="flex justify-between text-[#5d6a76]">
          <dt>Tax 8.5%</dt>
          <dd className="tabular-nums">{usd(tax)}</dd>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{usd(subtotal + tax)}</dd>
        </div>
      </dl>

      {/* The stamp: a real-world mark, so the uppercase is the object's, not a UI label. */}
      <div className="stamp pointer-events-none absolute bottom-5 left-24 rounded-md border-[3px] border-[#c2362f] px-3 py-1 font-display text-2xl font-bold tracking-[0.12em] text-[#c2362f] opacity-90 mix-blend-multiply">
        PAID
      </div>
    </div>
  );
}
