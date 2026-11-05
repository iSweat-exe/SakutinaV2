import type { Metadata } from "next";
import { ModerationView } from "@/components/moderation/moderation-view";
import { PageMain } from "@/components/shell/page-main";

export const metadata: Metadata = { title: "Moderation" };

export default function ModerationPage() {
  return (
    <PageMain>
      <ModerationView />
    </PageMain>
  );
}
