import { test, expect, type Page } from "@playwright/test";

// Helper: reset the in-memory mock store before each test
async function resetStore(page: Page) {
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__e2eMockStore as {
      resetStore: () => void;
    } | undefined;
    store?.resetStore();
  });
}

// Helper: wait for the ideas page to be ready (past loading skeleton)
async function waitForIdeasPage(page: Page) {
  await page.goto("/ideas");
  await page.waitForSelector("#main-content");
  await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'));
}

// Helper: create an idea via the quick capture form
async function createIdea(page: Page, title: string) {
  const input = page.getByLabel("Capture new idea");
  await input.fill(title);
  await input.press("Enter");
  // Wait for the card to appear (collapsed cards have aria-label=title)
  await expect(page.getByRole("button", { name: title })).toBeVisible();
}

// Helper: find a collapsed idea card by title
function ideaCard(page: Page, title: string) {
  return page.getByRole("button", { name: title });
}

test.describe("Ideas page", () => {
  test.beforeEach(async ({ page }) => {
    await waitForIdeasPage(page);
    await resetStore(page);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'));
  });

  test("renders empty state when no ideas exist", async ({ page }) => {
    await expect(page.getByText("No ideas yet")).toBeVisible();
  });

  test("create an idea via quick capture", async ({ page }) => {
    await createIdea(page, "My test idea");
    await expect(ideaCard(page, "My test idea")).toBeVisible();
    await expect(page.getByText("No ideas yet")).not.toBeVisible();
  });

  test("expand and collapse an idea card", async ({ page }) => {
    await createIdea(page, "Expandable idea");

    // Expand
    await ideaCard(page, "Expandable idea").click();

    // The card should now be expanded (aria-expanded=true)
    await expect(page.locator("[aria-expanded='true']")).toBeVisible();

    // Close the card
    await page.getByLabel("Close idea").click();

    // The card should be collapsed again (role=button returns)
    await expect(ideaCard(page, "Expandable idea")).toBeVisible();
  });

  test("edit an idea title and body", async ({ page }) => {
    await createIdea(page, "Editable idea");
    await ideaCard(page, "Editable idea").click();

    // Enter edit mode
    await page.getByLabel("Edit idea").click();

    // Edit the body
    const bodyInput = page.getByLabel("Idea body");
    await bodyInput.fill("This is the body content");

    // Exit edit mode
    await page.getByLabel("Done editing").click();

    // Body should be visible in view mode (use first() since preview also shows it)
    await expect(page.getByText("This is the body content").first()).toBeVisible();
  });

  test("archive an idea from the expanded view", async ({ page }) => {
    await createIdea(page, "Archive me");
    await ideaCard(page, "Archive me").click();

    // Click the Archive button inside the expanded card (not the header link)
    const archiveBtn = page.locator("[aria-expanded='true']").getByRole("button", { name: /Archive/i });
    await archiveBtn.click();

    // Idea should disappear, empty state should return
    await expect(page.getByText("No ideas yet")).toBeVisible();
  });

  test("create multiple ideas and verify both appear", async ({ page }) => {
    await createIdea(page, "First idea");
    await createIdea(page, "Second idea");

    await expect(ideaCard(page, "First idea")).toBeVisible();
    await expect(ideaCard(page, "Second idea")).toBeVisible();
  });

  test("marking an idea as refine-next moves it to the top", async ({ page }) => {
    await createIdea(page, "Alpha");
    await createIdea(page, "Beta");
    await createIdea(page, "Gamma");

    // Default order: Alpha, Beta, Gamma (insertion order, all sortOrder=0)
    const cards = page.locator("ul > li [role='button'][aria-expanded]");
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute("aria-label", "Alpha");
    await expect(cards.last()).toHaveAttribute("aria-label", "Gamma");

    // Click "Mark for refinement" on Gamma (the last card)
    const refineBtn = page.getByLabel("Mark for refinement").last();
    await refineBtn.click();

    // Gamma should now be first — its sortOrder changed to -1
    await expect(cards.first()).toHaveAttribute("aria-label", "Gamma");
  });
});

test.describe("Swipe to archive", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("swipe right archives an idea on mobile", async ({ page }) => {
    await waitForIdeasPage(page);
    await resetStore(page);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'));

    await createIdea(page, "Swipe me away");

    // Get the card's bounding box for the swipe gesture
    const card = ideaCard(page, "Swipe me away");
    const box = await card.boundingBox();
    if (!box) throw new Error("Card not found");

    const startX = box.x + 30;
    const centerY = box.y + box.height / 2;

    // Dispatch pointer events directly for reliable swipe simulation
    const container = page.locator(".relative.overflow-hidden.rounded-xl").first();
    await container.dispatchEvent("pointerdown", {
      clientX: startX, clientY: centerY, pointerId: 1, button: 0, pointerType: "touch",
    });

    // Move in steps past the dead zone and threshold
    for (let dx = 0; dx <= 220; dx += 15) {
      await container.dispatchEvent("pointermove", {
        clientX: startX + dx, clientY: centerY, pointerId: 1, pointerType: "touch",
      });
    }

    await container.dispatchEvent("pointerup", {
      clientX: startX + 220, clientY: centerY, pointerId: 1, pointerType: "touch",
    });

    // The idea should be archived (the card should fly out and disappear)
    await expect(ideaCard(page, "Swipe me away")).not.toBeVisible({ timeout: 3000 });
  });
});
