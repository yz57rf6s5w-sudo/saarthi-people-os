import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { boundedString, handleRecruitmentBriefRequest } from "../index.ts";

Deno.test("boundedString validates and trims input", () => {
  assertEquals(boundedString("  Analyst  ", 40), "Analyst");
  assertEquals(boundedString(" ", 40), null);
  assertEquals(boundedString(42, 40), null);
  assertEquals(boundedString("x".repeat(41), 40), null);
});

Deno.test("rejects unapproved origin", async () => {
  const response = await handleRecruitmentBriefRequest(new Request("https://example.invalid", {
    method: "POST", headers: { Origin: "https://attacker.invalid" },
  }));
  assertEquals(response.status, 403);
});

Deno.test("rejects non-POST methods", async () => {
  const response = await handleRecruitmentBriefRequest(new Request("https://example.invalid", { method: "GET" }));
  assertEquals(response.status, 405);
});

Deno.test("rejects declared oversized request bodies", async () => {
  const response = await handleRecruitmentBriefRequest(new Request("https://example.invalid", {
    method: "POST", headers: { "Content-Length": "9000" },
  }));
  assertEquals(response.status, 413);
});

Deno.test("returns a safe unavailable response when not configured", async () => {
  const response = await handleRecruitmentBriefRequest(new Request("https://example.invalid", {
    method: "POST", headers: { "Content-Type": "application/json" },
  }));
  assertEquals(response.status, 503);
});
