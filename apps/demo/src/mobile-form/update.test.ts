import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init, type Model } from "./model";
import { update } from "./update";

const ready = (): Model => ({ ...init(), today: "2026-10-20" });
const apply = (model: Model, ...messages: ReadonlyArray<Message>): Model =>
  messages.reduce((current, message) => update(current, message).model, model);
const commandNames = (result: ReturnType<typeof update>) =>
  (result.commands ?? []).map(({ name }) => name);

const aboutYou = [
  Message.ChangedText({ field: "first-name", value: "Ada" }),
  Message.ChangedText({ field: "last-name", value: "Lovelace" }),
  Message.ChangedText({ field: "email", value: "ada@example.com" }),
  Message.ChangedText({ field: "phone", value: "+1 555 123 4567" }),
  Message.ChangedText({ field: "dob", value: "07041990" }),
];

describe("mobile candidate form", () => {
  it("normalizes masked fields in the model, whatever the input path", () => {
    const model = apply(ready(), ...aboutYou);

    expect(model.values.text.phone).toBe("(555) 123-4567");
    expect(model.values.text.dob).toBe("07/04/1990");
  });

  it("keeps keystrokes in memory and saves the draft when a field is left", () => {
    const typed = update(ready(), Message.ChangedText({ field: "first-name", value: "A" }));
    const left = update(typed.model, Message.LeftField({ field: "first-name" }));

    expect(commandNames(typed)).toEqual([]);
    expect(commandNames(left)).toEqual(["PersistMobileForm"]);
    expect(left.model.visited).toEqual(["first-name"]);
  });

  it("reveals every error on submit and focuses the first invalid field", () => {
    const result = update(
      apply(ready(), Message.ChangedText({ field: "first-name", value: "Ada" })),
      Message.Submitted(),
    );

    expect(result.model.step).toBe("About");
    expect(result.model.visited).toEqual(["first-name", "last-name", "email", "phone", "dob"]);
    expect(result.model.announcement).toBe("4 fields need attention.");
    expect(commandNames(result)).toEqual(["FocusMobileFormField"]);
  });

  it("rejects candidates younger than sixteen", () => {
    const model = apply(
      ready(),
      ...aboutYou,
      Message.ChangedText({ field: "dob", value: "01012015" }),
      Message.Submitted(),
    );

    expect(model.step).toBe("About");
  });

  it("walks every step and submits a complete one-time code", () => {
    const verify = apply(
      ready(),
      ...aboutYou,
      Message.Submitted(),
      Message.ChangedText({ field: "street", value: "1 Main Street" }),
      Message.ChangedText({ field: "city", value: "Oakland" }),
      Message.AutofilledState({ code: "CA" }),
      Message.ChangedText({ field: "zip", value: "94612-1234" }),
      Message.Submitted(),
      Message.SelectedEmployment({ value: "part-time" }),
      Message.SteppedHours({ delta: 50 }),
      Message.ChangedText({ field: "start-date", value: "2026-11-02" }),
      Message.ToggledShift({ shift: "evenings" }),
      Message.Submitted(),
      Message.Answered({ question: "license", answer: "no" }),
      Message.Answered({ question: "rehire", answer: "no" }),
      Message.Submitted(),
    );

    expect(verify.step).toBe("Verify");
    expect(verify.values.hours).toBe(60);
    expect(verify.values.text.zip).toBe("94612");

    const done = update(verify, Message.ChangedText({ field: "otp", value: "12a3456" }));
    expect(done.model.values.text.otp).toBe("123456");
    expect(done.model.step).toBe("Done");
  });

  it("validates follow-up questions only while their answer reveals them", () => {
    const background: Model = { ...ready(), step: "Background" };
    const unanswered = update(background, Message.Submitted());
    expect(unanswered.model.step).toBe("Background");
    expect(unanswered.model.announcement).toBe("2 fields need attention.");

    const yes = apply(
      background,
      Message.Answered({ question: "license", answer: "yes" }),
      Message.Answered({ question: "rehire", answer: "no" }),
      Message.Answered({ question: "cdl", answer: "yes" }),
      Message.Submitted(),
    );
    // The license number and the nested CDL class are now required.
    expect(yes.step).toBe("Background");
    expect(yes.announcement).toBe("2 fields need attention.");

    const typed = apply(yes, Message.ChangedText({ field: "license-number", value: "D1234567" }));
    const no = apply(typed, Message.Answered({ question: "license", answer: "no" }));
    // Hidden fields keep their values but no longer block the step.
    expect(no.values.text["license-number"]).toBe("D1234567");
    expect(update(no, Message.Submitted()).model.step).toBe("Verify");
    // Answering yes again restores the previous answers, which still need a class.
    const again = apply(no, Message.Answered({ question: "license", answer: "yes" }));
    expect(again.values.text["license-number"]).toBe("D1234567");
    expect(update(again, Message.Submitted()).model.step).toBe("Background");
  });

  it("requires a past month for a previous job", () => {
    const answered = apply(
      { ...ready(), step: "Background" },
      Message.Answered({ question: "license", answer: "no" }),
      Message.Answered({ question: "rehire", answer: "yes" }),
      Message.ChangedText({ field: "previous-location", value: "Oakland" }),
      Message.ChangedText({ field: "previous-end", value: "122026" }),
    );

    expect(answered.values.text["previous-end"]).toBe("12/2026");
    expect(update(answered, Message.Submitted()).model.step).toBe("Background");
    const past = apply(answered, Message.ChangedText({ field: "previous-end", value: "062022" }));
    expect(update(past, Message.Submitted()).model.step).toBe("Verify");
  });

  it("rejects start dates in the past", () => {
    const model = apply(
      { ...ready(), step: "Work" },
      Message.SelectedEmployment({ value: "seasonal" }),
      Message.ChangedText({ field: "start-date", value: "2026-10-19" }),
      Message.ToggledShift({ shift: "weekends" }),
      Message.Submitted(),
    );

    expect(model.step).toBe("Work");
    expect(model.visited).toContain("start-date");
  });

  it("restores a saved draft and the current date", () => {
    const draft = {
      version: 2 as const,
      step: "Address" as const,
      values: apply(ready(), ...aboutYou).values,
    };
    const model = update(init(), Message.Restored({ today: "2026-10-20", draft })).model;

    expect(model.step).toBe("Address");
    expect(model.values.text["first-name"]).toBe("Ada");
    expect(model.today).toBe("2026-10-20");
  });
});
