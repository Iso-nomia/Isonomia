import fetch from "node-fetch";

async function main() {
  const [, , marketId] = process.argv;
  if (!marketId) throw new Error("Usage: node scripts/loadtest.js <marketId>");

  const latencies = [];
  const startTotal = Date.now();
  const requests = Array.from({ length: 100 }, () => {
    const t0 = Date.now();
    return fetch(`http://localhost:3000/api/market/${marketId}/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spendCents: 100, side: "YES" }),
    }).then((r) => {
      latencies.push(Date.now() - t0);
      return r;
    });
  });

  const responses = await Promise.all(requests);
  const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  console.log("p95 latency", p95);
  if (p95 > 300) throw new Error("Latency p95 > 300ms");
  const errors = responses.filter((r) => r.status >= 500);
  if (errors.length) throw new Error(`${errors.length} server errors`);

  const wallet = await fetch("http://localhost:3000/api/wallet").then((r) => r.json());
  const market = await fetch(`http://localhost:3000/api/market/${marketId}`).then((r) => r.json());
  if (wallet.balanceCents !== 0) throw new Error("wallet.balance not zero");
  if (Math.round(market.market.yesPool) !== 10000) throw new Error("pool mismatch");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
