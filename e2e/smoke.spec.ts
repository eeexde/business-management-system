import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "demo@bizdesk.app", password = "demo1234") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("redirects anonymous users to login", async ({ page }) => {
  await page.goto("/invoices");
  await expect(page).toHaveURL(/\/login\?next=%2Finvoices/);
});

test("rejects bad credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@bizdesk.app");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("one-click demo sign-in signs in with that role", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Sign in as staff/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Sam Lee", { exact: true })).toBeVisible();
});

test("every main section renders without errors", async ({ page }) => {
  await login(page);
  for (const section of ["Dashboard", "Customers", "Products", "Invoices", "Expenses", "Tasks", "Reports", "Settings"]) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: section }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});

test("create a customer, then invoice them and record payment", async ({ page }) => {
  await login(page);
  const name = `E2E Customer ${Date.now()}`;

  await page.goto("/customers/new");
  await page.getByLabel("Name").first().fill(name);
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByRole("button", { name: /save|create/i }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("link", { name: /new invoice/i }).click();
  await expect(page).toHaveURL(/\/invoices\/new\?customerId=\d+/);

  // One custom line: 2 × $50.00, no tax.
  await page.getByLabel("Line 1 description").fill("Consulting hours");
  await page.getByLabel("Line 1 quantity").fill("2");
  await page.getByLabel("Line 1 unit price").fill("50");
  await page.getByLabel("Tax rate (%)").fill("0");
  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page).toHaveURL(/\/invoices\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: /^INV-\d+$/ })).toBeVisible();
  await expect(page.getByText("$100.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();

  // Amount defaults to the full balance due.
  await expect(page.getByLabel("Amount")).toHaveValue("100.00");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Paid in full/)).toBeVisible();
});

test("staff cannot reach invoice editing", async ({ page }) => {
  await login(page, "sam@bizdesk.app");
  await page.goto("/invoices");
  await expect(page.getByRole("link", { name: /new invoice/i })).toHaveCount(0);

  // Direct URL: redirected with an explanation, not a 500 error page.
  await page.goto("/invoices/new");
  await expect(page).toHaveURL(/\/invoices\?notice=forbidden/);
  await expect(page.getByText("You don't have permission to do that.", { exact: false })).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("CSV export downloads for a signed-in user", async ({ page }) => {
  await login(page);
  const res = await page.request.get("/reports/export/pnl?range=last-12-months");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect((await res.text()).split("\n").length).toBeGreaterThan(2);
});

test("staff cannot see team management", async ({ page }) => {
  await login(page, "sam@bizdesk.app");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /add user|invite|create user/i })).toHaveCount(0);
});

test("logout ends the session and revokes the old cookie", async ({ page, context, browser }) => {
  await login(page, "priya@bizdesk.app");
  const stolen = (await context.cookies()).find((c) => c.name === "bizdesk_session");
  expect(stolen).toBeDefined();

  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // Replaying the pre-logout cookie in a fresh browser must not get in.
  const other = await browser.newContext();
  await other.addCookies([stolen!]);
  const replay = await other.newPage();
  await replay.goto("/dashboard");
  await expect(replay).toHaveURL(/\/login/);
  await other.close();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
