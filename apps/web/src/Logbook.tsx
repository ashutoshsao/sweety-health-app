import { useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  slots,
  type Period,
  type Reading,
  type ReadingInput,
  type Reports,
  type Session,
  type Slot,
} from "./api";
import ReadingForm, { type ReadingEditor } from "./ReadingForm";
import { dayLabel, readingTimeLabel, reportingToday, shiftDay } from "./time";

function ReportSummary({ period, empty }: { period: Period; empty: string }) {
  const { highest, lowest, average, count } = period.summary;
  if (count === 0) return <p className="empty-period">{empty}</p>;
  return (
    <dl className="report-stats">
      <div>
        <dt>Highest</dt>
        <dd>
          {highest}
          <span> mg/dl</span>
        </dd>
      </div>
      <div>
        <dt>Lowest</dt>
        <dd>
          {lowest}
          <span> mg/dl</span>
        </dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd>
          {average?.toFixed(1)}
          <span> mg/dl</span>
        </dd>
      </div>
      <div>
        <dt>Readings</dt>
        <dd>{count}</dd>
      </div>
    </dl>
  );
}

function PeriodReport({ title, period }: { title: string; period: Period }) {
  const range =
    period.startDate === period.endDate
      ? dayLabel(period.startDate)
      : `${dayLabel(period.startDate)} – ${dayLabel(period.endDate)}`;
  return (
    <section className="period-report" aria-label={title}>
      <h2>{title}</h2>
      <p className="period-range">{range}</p>
      <ReportSummary period={period} empty="No readings for this period" />
    </section>
  );
}

function DeleteDialog({
  reading,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  reading: Reading;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const slot = slots.find(([key]) => key === reading.slot)?.[1];

  function cancel() {
    if (busy) return;
    dialog.current?.close();
    onCancel();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-title"
      aria-describedby="delete-message"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="delete-title">Delete reading?</h2>
      <p id="delete-message">
        Remove the {slot} reading ({reading.value} mg/dl) for{" "}
        {dayLabel(reading.date)}?
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" disabled={busy} onClick={cancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Deleting…" : "Delete reading"}
        </button>
      </div>
    </dialog>
  );
}

type DayResponse =
  { date: string; data: Reports } | { date: string; error: string };
const earliestDate = "0001-02-01";

export default function Logbook({
  session,
  onSignOut,
  onExpired,
}: {
  session: Session;
  onSignOut: () => void;
  onExpired: () => void;
}) {
  const { token, user } = session;
  const today = reportingToday(user.timeZone);
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<DayResponse | null>(null);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<ReadingEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reading | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const focusSlot = useRef<Slot | null>(null);
  const current = result?.date === date ? result : null;
  const data = current && "data" in current ? current.data : null;

  useEffect(() => {
    const controller = new AbortController();
    api<Reports>(`/reports?date=${encodeURIComponent(date)}`, {
      token,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ date, data });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        else setResult({ date, error: error.message });
      });
    return () => controller.abort();
  }, [date, revision, token, onExpired]);

  useEffect(() => {
    if (!data || editor || deleteTarget || !focusSlot.current) return;
    document.getElementById(`slot-action-${focusSlot.current}`)?.focus();
    focusSlot.current = null;
  }, [data, editor, deleteTarget]);

  function refresh() {
    setResult(null);
    setRevision((value) => value + 1);
  }

  function chooseDate(next: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(next) ||
      next < earliestDate ||
      next > today ||
      next === date
    )
      return;
    setAnnouncement("");
    setEditor(null);
    setDate(next);
  }

  async function save(input: ReadingInput) {
    const reading = editor?.reading;
    try {
      const result = await api<{ reading: Reading }>(
        reading ? `/readings/${reading.id}` : "/readings",
        { token, method: reading ? "PATCH" : "POST", body: input },
      );
      focusSlot.current = result.reading.slot;
      setEditor(null);
      setDate(result.reading.date);
      setAnnouncement(reading ? "Reading updated." : "Reading added.");
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else throw error;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api(`/readings/${deleteTarget.id}`, { token, method: "DELETE" });
      focusSlot.current = deleteTarget.slot;
      setDeleteTarget(null);
      setAnnouncement("Reading deleted.");
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setDeleteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-content">
          <span className="wordmark">
            Sweety<span aria-hidden="true">.</span>
          </span>
          <button className="text-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="logbook">
        <div className="logbook-heading">
          <div>
            <h1>Blood glucose logbook</h1>
            <p>Reporting timezone · {user.timeZone}</p>
          </div>
          <div
            className="date-actions"
            role="group"
            aria-label="Choose a reporting date"
          >
            <button
              className="button secondary day-arrow"
              aria-label="Previous day"
              disabled={busy || date === earliestDate}
              onClick={() => chooseDate(shiftDay(date, -1))}
            >
              ‹
            </button>
            <input
              type="date"
              aria-label="Reporting date"
              value={date}
              min={earliestDate}
              max={today}
              disabled={busy}
              onChange={(event) => chooseDate(event.target.value)}
            />
            <button
              className="button secondary day-arrow"
              aria-label="Next day"
              disabled={busy || date >= today}
              onClick={() => chooseDate(shiftDay(date, 1))}
            >
              ›
            </button>
            <button
              className="button secondary today-button"
              disabled={busy || date === today}
              onClick={() => chooseDate(today)}
            >
              Today
            </button>
          </div>
        </div>
        <p className="sr-only" role="status">
          {announcement}
        </p>
        {!current && (
          <p className="loading-panel" role="status">
            Loading readings…
          </p>
        )}
        {current && "error" in current && (
          <div className="loading-panel">
            <p className="error" role="alert">
              {current.error}
            </p>
            <button className="button secondary" onClick={refresh}>
              Try again
            </button>
          </div>
        )}
        {data && (
          <>
            <section className="daily-report" aria-labelledby="daily-title">
              <h2 id="daily-title">{dayLabel(date, "full")}</h2>
              <ol className="slot-list">
                {slots.map(([slot, label]) => {
                  const reading = data.daily.readings.find(
                    (item) => item.slot === slot,
                  );
                  return (
                    <li className={reading ? "slot filled" : "slot"} key={slot}>
                      <h3>{label}</h3>
                      {reading ? (
                        <>
                          <div className="slot-value">
                            <strong>{reading.value}</strong>
                            <span>mg/dl</span>
                          </div>
                          <time
                            dateTime={reading.recordedAt}
                            className="slot-time"
                          >
                            {readingTimeLabel(reading.recordedAt, reading.date)}
                          </time>
                          <div className="slot-actions">
                            <button
                              id={`slot-action-${slot}`}
                              className="text-button"
                              aria-label={`Edit ${label} reading`}
                              disabled={busy}
                              onClick={() => setEditor({ slot, reading })}
                            >
                              Edit
                            </button>
                            <button
                              className="text-button"
                              aria-label={`Delete ${label} reading`}
                              disabled={busy}
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(reading);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          id={`slot-action-${slot}`}
                          className="button add-slot"
                          aria-label={`Add reading for ${label}`}
                          disabled={busy}
                          onClick={() => setEditor({ slot })}
                        >
                          + Add reading
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {data.daily.summary.count === 4 && (
                <p className="field-note slot-limit">
                  You can add only 4 readings per day.
                </p>
              )}
              {editor && (
                <ReadingForm
                  key={editor.reading?.id ?? editor.slot}
                  editor={editor}
                  date={date}
                  timeZone={user.timeZone}
                  onSave={save}
                  onBusy={setBusy}
                  onCancel={() => {
                    focusSlot.current = editor.slot;
                    setEditor(null);
                  }}
                />
              )}
              <div className="daily-summary">
                <h3>Daily summary</h3>
                <ReportSummary
                  period={data.daily}
                  empty="No readings for this day"
                />
              </div>
            </section>
            <div className="period-reports">
              <PeriodReport title="Month-to-date" period={data.monthToDate} />
              <PeriodReport title="Previous month" period={data.monthly} />
            </div>
          </>
        )}
      </main>
      {deleteTarget && (
        <DeleteDialog
          reading={deleteTarget}
          busy={busy}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
