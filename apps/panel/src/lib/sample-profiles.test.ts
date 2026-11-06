import { describe, expect, test } from "bun:test";
import { parseProfiles } from "@/lib/sample-profiles";

const entry = (username: unknown, large: unknown) => ({ login: { username }, picture: { large } });

describe("parseProfiles", () => {
  test("garde le pseudo et le portrait de randomuser.me", () => {
    expect(parseProfiles({ results: [entry("redcat784", "https://randomuser.me/api/portraits/women/86.jpg")] })).toEqual([
      { username: "redcat784", avatar: "https://randomuser.me/api/portraits/women/86.jpg" },
    ]);
  });

  test("écarte une image d'un autre site ou un pseudo inattendu", () => {
    expect(
      parseProfiles({
        results: [
          entry("redcat784", "https://evil.example/x.jpg"),
          entry("<script>", "https://randomuser.me/api/portraits/men/1.jpg"),
          entry("ok_name", "https://randomuser.me/api/portraits/../../x"),
          entry(42, "https://randomuser.me/api/portraits/men/1.jpg"),
        ],
      }),
    ).toEqual([]);
  });

  test("réponse illisible : liste vide", () => {
    expect(parseProfiles(null)).toEqual([]);
    expect(parseProfiles({ error: "down" })).toEqual([]);
  });
});
