import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SciencePage } from "./SciencePage";
import type { ScienceSkill } from "@/lib/science";
import { useRuntimeStore } from "@/lib/runtime";

// Force the data path (the bundled skills live on the Rust side).
vi.mock("@/lib/tauri", () => ({ isTauri: true }));
const listScienceSkills = vi.fn();
vi.mock("@/lib/science", () => ({
  listScienceSkills: () => listScienceSkills(),
  scienceSkillPrompt: (s: ScienceSkill) => `Use ${s.dir}: ${s.tagline}`,
}));

const SKILLS: ScienceSkill[] = [
  { dir: "stats-integrity", title: "Stats Integrity", tagline: "Enforces an execute-don't-interpret boundary." },
  { dir: "large-file", title: "Large File", tagline: "Returns a memory pointer for huge files." },
  { dir: "domain-check", title: "Domain Check", tagline: "Pre-execution domain guard for the analysis." },
];

function LiveProbe() {
  const { sessionId } = useParams();
  return <div>live-page {sessionId ?? ""}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/science"]}>
      <Routes>
        <Route path="/science" element={<SciencePage />} />
        <Route path="/live/:sessionId" element={<LiveProbe />} />
        <Route path="/live" element={<div>live-page</div>} />
     </Routes>
   </MemoryRouter>,
  );
}

describe("SciencePage", () => {
  beforeEach(() => {
    listScienceSkills.mockReset();
  });

  it("lists each bundled skill as a startable card with its title, dir, and tagline", async () => {
    listScienceSkills.mockResolvedValue(SKILLS);
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Science skills" })).toBeInTheDocument();
    // Each card renders title + skill id + the SKILL.md's "use when" blurb.
    for (const s of SKILLS) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
      expect(screen.getByText(s.dir)).toBeInTheDocument();
      expect(screen.getByText(s.tagline)).toBeInTheDocument();
    }
    // A "Use this skill" action per card.
    expect(screen.getAllByText("Use this skill")).toHaveLength(SKILLS.length);
  });

  it("sends the skill prompt and reveals the live session when a card is used", async () => {
    listScienceSkills.mockResolvedValue(SKILLS);
    const sendPrompt = vi
      .spyOn(useRuntimeStore.getState(), "sendPrompt")
      .mockResolvedValue("sess-1");

    renderPage();
    const cards = await screen.findAllByRole("article");
    const firstCard = cards[0];

    await userEvent.click(firstCard.querySelector("button")!);

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(sendPrompt.mock.calls[0][0]).toContain("stats-integrity");
    expect(await screen.findByText("live-page sess-1")).toBeInTheDocument();

    sendPrompt.mockRestore();
  });

  it("settles into an empty-state when no skills are shipped", async () => {
    listScienceSkills.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText("No science skills shipped with this build."),
    ).toBeInTheDocument();
  });

  it("settles into an error note when the listing fails", async () => {
    listScienceSkills.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Could not load science skills.")).toBeInTheDocument();
  });
});