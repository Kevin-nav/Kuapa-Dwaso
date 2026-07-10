import { describe, expect, it } from "vitest";
import { BuyerEmailTemplatesProvider } from "./buyer-email-templates.provider.js";

describe("BuyerEmailTemplatesProvider", () => {
  it("builds a branded institution welcome email with a verification action", () => {
    process.env.PRODUCT_APP_URL = "https://app.example.test";
    const template = new BuyerEmailTemplatesProvider().institutionWelcome({
      contactName: "Ama Owusu",
      organizationName: "Harvest School",
      destinationMarket: "Kumasi",
    });

    expect(template.subject).toContain("Harvest School");
    expect(template.text).toContain("/buyer/verification");
    expect(template.html).toContain("Kuapa Dwaso");
    expect(template.html).toContain("Complete verification");
  });

  it("escapes institution-controlled HTML values", () => {
    const template = new BuyerEmailTemplatesProvider().institutionWelcome({
      contactName: "<script>alert(1)</script>",
      organizationName: "A & B",
    });
    expect(template.html).not.toContain("<script>alert(1)</script>");
    expect(template.html).toContain("A &amp; B");
  });
});
