import { describe, expect, it } from "vitest";
import { getTelegramCommandResponse } from "./telegramInquiry";

describe("Telegram bot command responses", () => {
  it("provides every supported command response", () => {
    const commands = ["start", "help", "link", "inquiries", "support", "rules"] as const;

    for (const command of commands) {
      const message = getTelegramCommandResponse(command);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain("\\n");
    }
  });

  it("keeps the start response formatted for Telegram HTML", () => {
    const message = getTelegramCommandResponse("start");
    expect(message).toContain("<b>Alpha Market Bot</b>");
    expect(message).toContain("<b>Vendor Dashboard</b>");
  });

  it("keeps support and rules responses safely formatted for Telegram HTML", () => {
    expect(getTelegramCommandResponse("support")).toContain("<code>-1004418676694</code>");
    expect(getTelegramCommandResponse("rules")).toContain("<b>Escrow Policy:</b>");
    expect(getTelegramCommandResponse("rules")).toContain("<b>KYC Requirement:</b>");
  });
});
