"use client";

import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import { GitIcon, VercelIcon } from "../app/features/conversation/components/icons";
import Link from "next/link";

export const Navbar = () => {
  return (
    <div className="p-2 flex flex-row gap-2 justify-between items-center">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">AI Chat</h1>
      </div>
      <div className="flex gap-2">
        {/* Add other nav items here if needed */}
      </div>
    </div>
  );
};
