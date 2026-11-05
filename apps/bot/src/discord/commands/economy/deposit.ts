import { createMoveCommand } from "@/discord/commands/economy/move-command.ts";
import { messages } from "@/discord/messages.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";

export const depositCommand = createMoveCommand({
  name: "deposit",
  description: messages.economy.deposit.description,
  title: messages.economy.deposit.title,
  text: messages.economy.deposit.text,
  run: EconomyService.prototype.deposit,
});
