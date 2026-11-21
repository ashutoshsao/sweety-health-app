import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, mock, test } from "bun:test";
import type { ReadingInput } from "../src/api";
import ReadingForm, { type ReadingEditor } from "../src/ReadingForm";

afterEach(cleanup);

function renderForm(
  onSave: (input: ReadingInput) => Promise<void>,
  editor: ReadingEditor = { slot: "AFTER_LUNCH" },
) {
  render(
    <ReadingForm
      editor={editor}
      date="2024-11-03"
      timeZone="UTC"
      localTimeZone="America/New_York"
      onSave={onSave}
      onCancel={() => {}}
      onBusy={() => {}}
    />,
  );
  return screen.getByLabelText("Glucose value (mg/dl)") as HTMLInputElement;
}

test("the reading form reports required and out-of-range values before saving", () => {
  const save = mock(async () => {});
  const input = renderForm(save);
  const submit = screen.getByRole("button", { name: "Save reading" });
  fireEvent.click(submit);
  expect(screen.getByRole("alert").textContent).toBe(
    "Please enter a glucose value.",
  );
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "601" } });
  fireEvent.click(submit);
  expect(screen.getByRole("alert").textContent).toBe(
    "Value must be between 40 and 600 mg/dl.",
  );
  expect(save).not.toHaveBeenCalled();
});

test("a server conflict preserves the entered value and slot", async () => {
  const save = mock(async (_input: ReadingInput) => {
    throw new Error("You already have an After lunch reading for this date.");
  });
  const input = renderForm(save);
  fireEvent.change(input, { target: { value: "125" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "You already have an After lunch reading for this date.",
  );
  expect(input.value).toBe("125");
  expect((screen.getByLabelText("Time slot") as HTMLSelectElement).value).toBe(
    "AFTER_LUNCH",
  );
  expect(save).toHaveBeenCalledTimes(1);
});

test("changing the value alone preserves the second instance of a repeated local time", async () => {
  const save = mock(async (_input: ReadingInput) => {});
  const input = renderForm(save, {
    slot: "AFTER_LUNCH",
    reading: {
      id: "reading-1",
      slot: "AFTER_LUNCH",
      value: 125,
      date: "2024-11-03",
      recordedAt: "2024-11-03T06:30:45.000Z",
    },
  });
  expect(
    (screen.getByLabelText("Local date and time") as HTMLInputElement).value,
  ).toBe("2024-11-03T01:30");
  fireEvent.change(input, { target: { value: "126" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ slot: "AFTER_LUNCH", value: 126 }),
  );
});
