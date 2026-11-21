import { useEffect, useRef, useState, type FormEvent } from "react";
import { slots, type Reading, type ReadingInput, type Slot } from "./api";
import {
  dayLabel,
  deviceTimeZone,
  initialReadingTime,
  interpretLocalTime,
  readingTimeInput,
  reportingDayForInstant,
  reportingToday,
} from "./time";

export type ReadingEditor = { slot: Slot; reading?: Reading };

export default function ReadingForm({
  editor,
  date,
  timeZone,
  onSave,
  onCancel,
  onBusy,
  localTimeZone = deviceTimeZone,
}: {
  editor: ReadingEditor;
  date: string;
  timeZone: string;
  onSave: (input: ReadingInput) => Promise<void>;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  localTimeZone?: string;
}) {
  const { reading } = editor;
  const [initial] = useState(() =>
    reading
      ? {
          local: readingTimeInput(reading.recordedAt, localTimeZone),
          recordedAt: reading.recordedAt,
        }
      : initialReadingTime(date, timeZone, localTimeZone),
  );
  const [value, setValue] = useState(reading ? String(reading.value) : "");
  const [slot, setSlot] = useState(editor.slot);
  const [local, setLocal] = useState(initial.local);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"value" | "time" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const valueField = useRef<HTMLInputElement>(null);
  const timeField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    valueField.current?.focus();
  }, []);

  function getReadingTime() {
    return local === initial.local
      ? {
          recordedAt: initial.recordedAt,
          reportingDate: reportingDayForInstant(initial.recordedAt, timeZone),
        }
      : interpretLocalTime(local, timeZone, localTimeZone);
  }

  let previewDate: string | undefined;
  try {
    previewDate = getReadingTime().reportingDate;
  } catch {
    /* Show validation when submitted. */
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setInvalidField(null);

    const amount = Number(value);
    if (
      !value.trim() ||
      !/^\d+$/.test(value.trim()) ||
      amount < 40 ||
      amount > 600
    ) {
      setError(
        value.trim()
          ? "Value must be between 40 and 600 mg/dl."
          : "Please enter a glucose value.",
      );
      setInvalidField("value");
      valueField.current?.focus();
      return;
    }

    let recordedAt: string;
    try {
      const time = getReadingTime();
      if (time.reportingDate > reportingToday(timeZone))
        throw new Error("Date cannot be in the future.");
      recordedAt = time.recordedAt;
    } catch (cause) {
      setError(
        cause instanceof RangeError
          ? "Choose a valid date and time."
          : (cause as Error).message,
      );
      setInvalidField("time");
      timeField.current?.focus();
      return;
    }

    setBusy(true);
    onBusy(true);
    try {
      await onSave({
        value: amount,
        slot,
        ...(reading && local === initial.local ? {} : { recordedAt }),
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form
      className="editor"
      onSubmit={submit}
      aria-labelledby="reading-editor-title"
      noValidate
    >
      <h3 id="reading-editor-title">
        {reading ? "Edit reading" : "Add reading"}
      </h3>
      <div className="editor-fields">
        <label>
          Glucose value (mg/dl)
          <input
            ref={valueField}
            inputMode="numeric"
            disabled={busy}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={invalidField === "value" || undefined}
            aria-describedby={
              invalidField === "value" ? "reading-error" : undefined
            }
          />
        </label>
        <label>
          <span id="reading-slot-label">Time slot</span>
          <select
            aria-labelledby="reading-slot-label"
            disabled={busy}
            value={slot}
            onChange={(event) => setSlot(event.target.value as Slot)}
          >
            {slots.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Local date and time
          <input
            ref={timeField}
            type="datetime-local"
            disabled={busy}
            value={local}
            onChange={(event) => setLocal(event.target.value)}
            aria-invalid={invalidField === "time" || undefined}
            aria-describedby={
              invalidField === "time" ? "reading-error" : undefined
            }
          />
        </label>
      </div>
      {previewDate && previewDate !== local.slice(0, 10) && (
        <p className="field-note">Reporting date · {dayLabel(previewDate)}</p>
      )}
      {error && (
        <p className="error" role="alert" id="reading-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : reading ? "Save changes" : "Save reading"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
