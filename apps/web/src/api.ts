export const slots = [
  ["MORNING_FASTING", "Morning (fasting)"],
  ["AFTER_BREAKFAST", "After breakfast"],
  ["AFTER_LUNCH", "After lunch"],
  ["AFTER_DINNER", "After dinner"],
] as const;

export type Slot = (typeof slots)[number][0];
export type User = {
  id: string;
  name: string;
  email: string;
  timeZone: string;
};
export type Session = { token: string; user: User };
export type Reading = {
  id: string;
  recordedAt: string;
  date: string;
  slot: Slot;
  value: number;
};
export type ReadingInput = { recordedAt?: string; slot: Slot; value: number };
export type Period = {
  startDate: string;
  endDate: string;
  summary: {
    highest: number | null;
    lowest: number | null;
    average: number | null;
    count: number;
  };
};
export type Reports = {
  selectedDate: string;
  daily: Period & { readings: Reading[] };
  monthToDate: Period;
  monthly: Period;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  {
    token,
    body,
    method = "GET",
    signal,
  }: {
    token?: string;
    body?: object;
    method?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Couldn’t reach Sweety. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(
      response.status,
      payload?.error ?? "Something went wrong. Please try again.",
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
