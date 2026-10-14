import type { Page } from "playwright";
import { expect, it } from "vitest";

export const viewspecScenarios = (
  getPage: () => Page,
  appUrl: string,
  screenshot: (name: string) => Promise<void>,
): void => {
  it("replays ViewSpec prompts into interactive generated documents", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/viewspec`, { waitUntil: "networkidle" });
    const playground = page.locator('[data-viewspec-playground="true"]');
    const generate = playground.getByRole("button", { name: "Generate mock UI", exact: true });
    await playground.getByLabel("UI prompt", { exact: true }).fill(" ");
    await expect.poll(() => generate.isDisabled()).toBe(true);
    await playground.getByLabel("Response cassette", { exact: true }).selectOption("mission-brief");
    const prompt = "Build a landing party briefing for our next expedition.";
    await playground.getByLabel("UI prompt", { exact: true }).fill(prompt);
    await generate.click();
    await expect
      .poll(() =>
        playground.getByRole("button", { name: "Generating mock UI…", exact: true }).isDisabled(),
      )
      .toBe(true);
    const generated = playground.getByRole("region", { name: "Generated UI", exact: true });
    await expect
      .poll(() =>
        generated.getByRole("heading", { name: "Landing party briefing", exact: true }).isVisible(),
      )
      .toBe(true);
    await expect.poll(() => generated.textContent()).toContain(prompt);
    await playground
      .getByRole("heading", { name: "Mock UI generation", exact: true })
      .scrollIntoViewIfNeeded();
    await screenshot("viewspec-mock-generation");
    await generated.getByRole("button", { name: "Assign Ford to the survey", exact: true }).click();
    await expect
      .poll(() =>
        playground.getByRole("status", { name: "Host receipt", exact: true }).textContent(),
      )
      .toContain("accepted the assignment for Ford Prefect");

    await playground.getByLabel("Response cassette", { exact: true }).selectOption("crew-cards");
    await generate.click();
    await expect
      .poll(() =>
        generated.getByRole("button", { name: "Choose Trillian", exact: true }).isVisible(),
      )
      .toBe(true);
    await generated.getByRole("button", { name: "Choose Trillian", exact: true }).click();
    await expect
      .poll(() => playground.getByRole("heading", { name: "Trillian", exact: true }).count())
      .toBe(2);

    await playground.getByLabel("Response cassette", { exact: true }).selectOption("off-duty");
    await generate.click();
    const request = generated.getByRole("button", {
      name: "Request Marvin's systems review",
      exact: true,
    });
    await expect.poll(() => request.isVisible()).toBe(true);
    await request.click();
    await expect
      .poll(() =>
        playground.getByRole("status", { name: "Host receipt", exact: true }).textContent(),
      )
      .toContain("crew member is off duty");
    await playground.getByRole("button", { name: "Inspect document", exact: true }).click();
    await expect
      .poll(() =>
        playground
          .getByRole("region", { name: "Generated version-1 document", exact: true })
          .isVisible(),
      )
      .toBe(true);
  });

  it("shows ViewSpec cassette failures, preserves valid output, and allows retry", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/viewspec`, { waitUntil: "networkidle" });
    const generate = page.getByRole("button", { name: "Generate mock UI", exact: true });
    const select = page.getByLabel("Response cassette", { exact: true });
    await select.selectOption("mission-brief");
    await generate.click();
    const generated = page.getByRole("region", { name: "Generated UI", exact: true });
    await expect
      .poll(() =>
        generated.getByRole("heading", { name: "Landing party briefing", exact: true }).isVisible(),
      )
      .toBe(true);
    for (const [cassette, error] of [
      ["invalid-component", "schema/JSON decoding"],
      ["broken-reference", "missing-child"],
      ["malformed-json", "schema/JSON decoding"],
      ["provider-error", "provider failure"],
    ] as const) {
      await select.selectOption(cassette);
      await generate.click();
      await expect.poll(() => page.getByRole("alert").textContent()).toContain(error);
      await expect
        .poll(() =>
          generated
            .getByRole("heading", { name: "Landing party briefing", exact: true })
            .isVisible(),
        )
        .toBe(true);
    }
    await select.selectOption("crew-cards");
    await generate.click();
    await expect
      .poll(() =>
        generated.getByRole("heading", { name: "Meet the crew", exact: true }).isVisible(),
      )
      .toBe(true);
    await expect.poll(() => page.getByRole("alert").count()).toBe(0);
    await page.getByRole("button", { name: "Reset playground", exact: true }).click();
    await expect.poll(() => generated.count()).toBe(0);
  });

  it("completes the ViewSpec fixture interaction and leaves execution with the host", async () => {
    const page = getPage();
    await page.goto(`${appUrl}/viewspec`, { waitUntil: "networkidle" });
    const playground = page.locator('[data-viewspec-playground="true"]');
    const submit = playground.getByRole("button", { name: "Request assignment", exact: true });
    await expect.poll(() => submit.isDisabled()).toBe(true);
    await playground.getByLabel("Filter crew", { exact: true }).fill("Ford");
    await expect.poll(() => playground.getByRole("button", { name: /^Select / }).count()).toBe(1);
    await playground.getByRole("button", { name: "Select Ford Prefect", exact: true }).click();
    await playground.getByLabel("Assignment note", { exact: true }).fill("Survey the landing site");
    await expect.poll(() => submit.isEnabled()).toBe(true);
    await submit.click();
    await expect
      .poll(() =>
        playground.getByRole("status", { name: "Host receipt", exact: true }).textContent(),
      )
      .toBe("Fixture host accepted the assignment for Ford Prefect.");
    const intent = playground.getByRole("region", { name: "Last submitted intent", exact: true });
    await expect.poll(() => intent.textContent()).toContain('"crewId": "ford"');
    await expect.poll(() => intent.textContent()).toContain('"note": "Survey the landing site"');
    await screenshot("viewspec-accepted");

    await playground.getByLabel("Filter crew", { exact: true }).fill("no such crew");
    await expect
      .poll(() => playground.getByText("No crew matches", { exact: true }).isVisible())
      .toBe(true);
    await playground.getByLabel("Filter crew", { exact: true }).fill("Marvin");
    await playground.getByRole("button", { name: "Select Marvin", exact: true }).click();
    await expect
      .poll(() => playground.getByLabel("Assignment note", { exact: true }).inputValue())
      .toBe("");
    await playground.getByLabel("Assignment note", { exact: true }).fill("Review systems");
    await submit.click();
    await expect
      .poll(() =>
        playground.getByRole("status", { name: "Host receipt", exact: true }).textContent(),
      )
      .toContain("crew member is off duty");
    await playground.getByRole("button", { name: "Inspect document", exact: true }).click();
    await expect
      .poll(() =>
        playground
          .getByRole("region", { name: "Validated version-1 document", exact: true })
          .isVisible(),
      )
      .toBe(true);
    await playground.getByRole("button", { name: "Reset playground", exact: true }).click();
    await expect
      .poll(() => playground.getByLabel("Filter crew", { exact: true }).inputValue())
      .toBe("");
    await expect.poll(() => submit.isDisabled()).toBe(true);
  });

  it("keeps the ViewSpec draft usable by keyboard on a narrow dark viewport", async () => {
    const page = getPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appUrl}/viewspec`, { waitUntil: "networkidle" });
    await page.getByLabel("Appearance", { exact: true }).selectOption("Dark");
    const filter = page.getByLabel("Filter crew", { exact: true });
    await filter.focus();
    await page.keyboard.type("Trillian");
    await expect.poll(() => filter.inputValue()).toBe("Trillian");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.getByRole("heading", { name: "Trillian", exact: true }).count())
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toContain("Select Trillian");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Plot the route");
    await expect
      .poll(() => page.getByLabel("Assignment note", { exact: true }).inputValue())
      .toBe("Plot the route");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.getByRole("status", { name: "Host receipt", exact: true }).textContent())
      .toContain("accepted the assignment for Trillian");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await screenshot("viewspec-mobile-dark");
  });
};
