import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

export const mobileFormScenarios = (getPage: () => Page, appUrl: string) => {
  describe("mobile inputs", () => {
    it("guides a phone through the candidate form with masks, the state sheet, and a code", async () => {
      const page = getPage();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${appUrl}/mobile-form`, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.removeItem("foldworks-mobile-form"));
      await page.reload({ waitUntil: "networkidle" });
      const field = (name: string) => page.getByRole("textbox", { name, exact: true });

      await page.getByRole("button", { name: "Continue" }).click();
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("first-name");
      await expect.poll(() => page.getByText("Enter your first name.").isVisible()).toBe(true);

      await field("First name").pressSequentially("Ada");
      await field("First name").press("Enter");
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("last-name");
      await page.keyboard.type("Lovelace");
      await field("Email").fill("ada@gmial.com");
      await page.getByRole("button", { name: /Did you mean/ }).click();
      await expect.poll(() => field("Email").inputValue()).toBe("ada@gmail.com");
      await field("Mobile phone").pressSequentially("5551234567");
      await expect.poll(() => field("Mobile phone").inputValue()).toBe("(555) 123-4567");
      // Typing in the middle keeps the caret after the inserted digit.
      await field("Mobile phone").evaluate((input: HTMLInputElement) =>
        input.setSelectionRange(8, 8),
      );
      await page.keyboard.type("9");
      expect(await field("Mobile phone").inputValue()).toBe("(555) 129-3456");
      expect(
        await field("Mobile phone").evaluate((input: HTMLInputElement) => input.selectionStart),
      ).toBe(9);
      await field("Mobile phone").fill("+1 (555) 123-4567");
      await expect.poll(() => field("Mobile phone").inputValue()).toBe("(555) 123-4567");
      await field("Date of birth").pressSequentially("07041990");
      await expect.poll(() => field("Date of birth").inputValue()).toBe("07/04/1990");
      await page.getByRole("button", { name: "Continue" }).click();

      await page.getByRole("heading", { name: "Where do you live?" }).waitFor();
      await field("Street address").fill("1 Main Street");
      await field("City").fill("Oakland");
      await field("ZIP code").pressSequentially("94612-1234");
      await expect.poll(() => field("ZIP code").inputValue()).toBe("94612");
      await page.locator("#state").click();
      const sheet = page.getByRole("dialog", { name: "State" });
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("state-search");
      await page.keyboard.type("new y");
      await expect.poll(() => sheet.getByRole("button").allTextContents()).toEqual(["New YorkNY"]);
      await page.keyboard.press("Enter");
      await expect.poll(() => sheet.isVisible()).toBe(false);
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("state");
      expect(await page.locator("#state").innerText()).toContain("New York");
      await page.getByRole("button", { name: "Continue" }).click();

      await page.getByRole("heading", { name: "Your availability" }).waitFor();
      await page.getByText("Part-time", { exact: true }).click();
      for (let index = 0; index < 3; index++)
        await page.getByRole("button", { name: "More hours" }).click();
      await expect.poll(() => page.locator("#hours").inputValue()).toBe("23");
      await page.locator("#start-date").fill("2099-01-15");
      await page.getByText("Evenings", { exact: true }).click();
      await page.getByRole("button", { name: "Continue" }).click();

      await page.getByRole("heading", { name: "A few more questions" }).waitFor();
      const licenseFollowUp = page.locator("#license-follow-up");
      expect(await licenseFollowUp.getAttribute("inert")).not.toBeNull();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect.poll(() => page.getByText("Choose yes or no.").count()).toBe(2);
      await page.locator("label:has(#license-yes)").click();
      await expect.poll(() => licenseFollowUp.getAttribute("inert")).toBeNull();
      await field("License number").fill("D1234567");
      await page.locator("label:has(#cdl-yes)").click();
      await page.getByRole("button", { name: "Continue" }).click();
      // The nested class is now required; answering "No" above hides and releases it.
      await expect.poll(() => page.getByText("Choose a CDL class.").isVisible()).toBe(true);
      await page.locator("label:has(#license-no)").click();
      await expect.poll(() => licenseFollowUp.getAttribute("inert")).not.toBeNull();
      await expect
        .poll(() => licenseFollowUp.evaluate((element) => element.getBoundingClientRect().height))
        .toBe(0);
      await page.locator("label:has(#license-yes)").click();
      await expect.poll(() => field("License number").inputValue()).toBe("D1234567");
      await page.locator("label:has(#license-no)").click();
      await page.locator("label:has(#rehire-yes)").click();
      await field("Which location?").fill("Oakland");
      await field("When did you leave?").pressSequentially("062022");
      await expect.poll(() => field("When did you leave?").inputValue()).toBe("06/2022");
      await page.getByRole("button", { name: "Continue" }).click();

      await page.getByRole("heading", { name: "Verify your phone" }).waitFor();
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("otp");
      await page.keyboard.type("12a3456");
      await page.getByRole("heading", { name: "You're all set" }).waitFor();
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("foldworks-mobile-form")!).values.state,
        ),
      ).toBe("NY");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  });
};
