"use client";

import { Button } from "./ui/button";
import { GitIcon, VercelIcon } from "../app/features/conversation/components/icons";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export const Navbar = () => {
  return (
    <div className="p-2 flex flex-row gap-2 justify-between items-center">
      {/* Left section - reserved for logo/brand */}
      <div></div>

      {/* Right section - theme toggle */}
      <ThemeToggle />
    </div>
  );
};
