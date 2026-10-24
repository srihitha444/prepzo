// Read-only check that the Razorpay plan ids in the environment are what
// lib/ca/plans.ts advertises: recurring at the right period/interval, INR,
// and the exact price. A mismatch here means students are charged a different
// amount or cadence from the one the pricing page showed them.
//
// Usage (env vars come from the shell, or pass --env-file):
//   node --env-file=.env.production.local --experimental-strip-types scripts/check-razorpay-plans.mjs

const { CA_PLANS, priceFor, toPaise } = await import("../lib/ca/plans.ts");

// Same precedence as lib/ca/razorpay.ts.
const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.");
  process.exit(1);
}
console.log(`Mode: ${keyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} (${keyId.slice(0, 13)}…)`);
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  console.log("✗ RAZORPAY_WEBHOOK_SECRET is not set — renewals will never extend a plan.");
}

const expected = {
  monthly: { period: "monthly", interval: 1 },
  quarterly: { period: "monthly", interval: 3 },
  half_yearly: { period: "monthly", interval: 6 },
  yearly: { period: "yearly", interval: 1 },
};
const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
let problems = 0;

for (const plan of ["pro", "premium"]) {
  for (const cycle of Object.keys(expected)) {
    const envName = `RAZORPAY_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
    const id = process.env[envName];
    const amount = toPaise(priceFor(CA_PLANS[plan], cycle));
    if (!id) {
      console.log(`- ${envName} not set: the app will create a ₹${amount / 100} plan itself on first checkout.`);
      continue;
    }
    const res = await fetch(`https://api.razorpay.com/v1/plans/${id}`, { headers: { Authorization: auth } });
    const body = await res.json();
    if (!res.ok) {
      problems++;
      console.log(`✗ ${envName}=${id}: ${body?.error?.description ?? res.status}`);
      continue;
    }
    const issues = [];
    const want = expected[cycle];
    // 12 months as monthly×12 is the same cadence as yearly×1.
    const sameCadence =
      (body.period === want.period && body.interval === want.interval) ||
      (cycle === "yearly" && body.period === "monthly" && body.interval === 12);
    if (!sameCadence) issues.push(`renews every ${body.interval} ${body.period}, expected every ${want.interval} ${want.period}`);
    if (body.item.amount !== amount) issues.push(`charges ₹${body.item.amount / 100}, pricing page says ₹${amount / 100}`);
    if (body.item.currency !== "INR") issues.push(`currency ${body.item.currency}`);
    if (issues.length) problems++;
    console.log(`${issues.length ? "✗" : "✓"} ${envName}=${id} "${body.item.name}"${issues.length ? ": " + issues.join("; ") : ""}`);
  }
}

process.exitCode = problems ? 1 : 0;
