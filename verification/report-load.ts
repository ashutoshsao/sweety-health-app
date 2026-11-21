const baseUrl = "http://localhost:3001/api";
const concurrency = 8;
const durationSeconds = 30;
const signIn = await fetch(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "demo@sweety.example.invalid",
    password: "sweety-demo-2026",
  }),
  signal: AbortSignal.timeout(5_000),
});
if (!signIn.ok)
  throw new Error(
    `Demo login returned ${signIn.status}. Run the seed command first.`,
  );

const { token, user } = (await signIn.json()) as {
  token: string;
  user: { timeZone: string };
};
const date = Temporal.Now.plainDateISO(user.timeZone).toString();
const url = `${baseUrl}/reports?date=${date}`;
const headers = { Authorization: `Bearer ${token}` };

async function readReport() {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Report returned ${response.status}.`);
  const { daily } = (await response.json()) as {
    daily: { summary: { count: number } };
  };
  if (daily.summary.count !== 4)
    throw new Error("Expected the four seeded daily readings.");
}

await readReport();
const latencies: number[] = [];
let errors = 0;
const start = performance.now();
const end = start + durationSeconds * 1_000;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (performance.now() < end) {
      const before = performance.now();
      try {
        await readReport();
        latencies.push(performance.now() - before);
      } catch {
        errors += 1;
      }
    }
  }),
);

const seconds = (performance.now() - start) / 1_000;
latencies.sort((a, b) => a - b);

function percentile(value: number) {
  const index = Math.ceil(latencies.length * value) - 1;
  return latencies[index] === undefined
    ? null
    : Number(latencies[index].toFixed(2));
}

console.log(
  JSON.stringify(
    {
      seconds: Number(seconds.toFixed(2)),
      concurrency,
      requests: latencies.length + errors,
      errors,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
    },
    null,
    2,
  ),
);
if (errors) process.exitCode = 1;
