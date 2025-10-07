"use client";

import { Button } from "./ui/button";
import { GitIcon, VercelIcon } from "../app/features/conversation/components/icons";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export const Navbar = () => {
  return (
    <div className="p-2 flex flex-row gap-2 items-center justify-between">
      <Link href="https://github.com/vercel-labs/ai-sdk-preview-python-streaming">
        <Button variant="outline">
          <GitIcon /> View Source Code
        </Button>
      </Link>

      <div className="flex flex-row gap-2 items-center">
        <ThemeToggle />
        <Link href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-preview-python-streaming&env=OPENAI_API_KEY%2CVERCEL_FORCE_PYTHON_STREAMING&envDescription=API+keys+needed+for+application&envLink=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-preview-python-streaming%2Fblob%2Fmain%2F.env.example&teamSlug=vercel-labs">
          <Button>
            <VercelIcon />
            Deploy with Vercel
          </Button>
        </Link>
      </div>
    </div>
  );
};
