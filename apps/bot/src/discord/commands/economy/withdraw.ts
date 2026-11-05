import { createMoveCommand } from "@/discord/commands/economy/move-command.ts";
import { messages } from "@/discord/messages.ts";
import { EconomyService } from "@/domain/economy/economy-service.ts";

export const withdrawCommand = createMoveCommand({
  name: "withdraw",
  description: messages.economy.withdraw.description,
  title: messages.economy.withdraw.title,
  text: messages.economy.withdraw.text,
  run: EconomyService.prototype.withdraw,
});
