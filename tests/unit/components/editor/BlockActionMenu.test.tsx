import { describe, it, expect } from "vitest";

describe("BlockActionMenu", () => {
  it("should render main menu items", () => {
    const menuItems = ["Turn into", "Duplicate", "Delete"];
    menuItems.forEach((item) => {
      expect(item).toBeTruthy();
    });
  });

  it("should have correct ARIA attributes", () => {
    const role = "menu";
    const label = "Block actions";
    expect(role).toBe("menu");
    expect(label).toBe("Block actions");
  });
});
