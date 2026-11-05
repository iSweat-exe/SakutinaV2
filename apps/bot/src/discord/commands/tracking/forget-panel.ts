import { encodeId } from "@/discord/components/custom-id.ts";
import { messages } from "@/discord/messages.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, successPanel, type Panel } from "@/discord/ui/panels.ts";

/** Demande de confirmation : deux boutons, l'un destructeur (rouge), l'autre pour renoncer. */
export function buildForgetDialog(ownerId: string): Panel {
  const text = messages.forgetDialog;

  return createPanel({
    category: "tracking",
    tone: "danger",
    title: text.title,
    description: text.text,
    fields: [{ name: text.keptTitle, value: text.kept }],
    rows: [
      buttonRow(
        button({
          id: encodeId("fg", "confirm", ownerId),
          label: messages.controls.confirmForget,
          intent: "danger",
        }),
        button({
          id: encodeId("fg", "cancel", ownerId),
          label: messages.controls.cancel,
          intent: "neutral",
        }),
      ),
    ],
  });
}

export function buildForgetDone(): Panel {
  const text = messages.tracking.forget;

  return successPanel({
    category: "tracking",
    title: text.doneTitle,
    description: text.done,
    fields: [{ name: text.keptTitle, value: text.kept }],
  });
}

export function buildForgetCancelled(): Panel {
  const text = messages.forgetDialog;

  return createPanel({
    category: "tracking",
    title: text.cancelledTitle,
    description: text.cancelled,
  });
}
