import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv } from "./csv";

describe("escapeCsvValue", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvValue("Figma")).toBe("Figma");
    expect(escapeCsvValue(12.5)).toBe("12.5");
    expect(escapeCsvValue(-40)).toBe("-40");
    expect(escapeCsvValue(true)).toBe("true");
  });

  it("writes empty cells for null, undefined and non-finite numbers", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(NaN)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(escapeCsvValue("Rent, March")).toBe('"Rent, March"');
    expect(escapeCsvValue('The "big" one')).toBe('"The ""big"" one"');
    expect(escapeCsvValue("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(escapeCsvValue("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralises formula injection in text", () => {
    expect(escapeCsvValue("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(escapeCsvValue("@cmd")).toBe("'@cmd");
    expect(escapeCsvValue("+1, -1")).toBe(`"'+1, -1"`);
  });
});

describe("toCsv", () => {
  const columns = [
    { header: "Name", value: (r: { name: string; amount: number | null }) => r.name },
    { header: "Amount", value: (r: { name: string; amount: number | null }) => r.amount },
  ];

  it("writes a header and CRLF-terminated rows", () => {
    expect(toCsv([{ name: "Rent", amount: 4500 }, { name: "Coffee, beans", amount: null }], columns)).toBe(
      'Name,Amount\r\nRent,4500\r\n"Coffee, beans",\r\n',
    );
  });

  it("writes only the header when there are no rows", () => {
    expect(toCsv([], columns)).toBe("Name,Amount\r\n");
  });
});
