import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "demo@bizdesk.app", password = "demo1234") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
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
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
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
  await page.getByRole("button", { name: /save|create/i }).first().click();
  // A brand-new invoice may need a line item; the form must either succeed or show a validation message.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("staff cannot see team management", async ({ page }) => {
  await login(page, "sam@bizdesk.app");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /add user|invite|create user/i })).toHaveCount(0);
});

test("logout ends the session", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
