"use client";

import { ThemeToggle } from "./theme-toggle";

export const Navbar = () => {
  return (
    <div className="p-2 flex flex-row gap-2 items-center justify-end">
      <ThemeToggle />
    </div>
  );
};
