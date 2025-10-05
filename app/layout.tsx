import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "AI SDK Streaming Preview",
  description:
    "Use the Data Stream Protocol to stream chat completions from a endpoint and display them using the useChat hook in your Next.js application.",
  openGraph: {
    images: [
      {
        url: "/og?title=AI SDK Streaming Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/og?title=AI SDK Streaming Preview",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body className={cn(GeistSans.className, "antialiased")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" richColors />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
