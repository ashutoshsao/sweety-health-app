import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((response) => setStatus(response.ok ? "ready" : "unavailable"))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });

    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Sweety</h1>
      <p role="status">
        {status === "checking" && "Checking the API connection…"}
        {status === "ready" && "The API and database are ready."}
        {status === "unavailable" && "The API or database is unavailable."}
      </p>
    </main>
  );
}
