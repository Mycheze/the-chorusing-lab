import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { FeedbackButton } from "@/components/ui/FeedbackButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chorus Lab - Language Learning Through Chorusing",
  description:
    "Master languages through chorusing - the powerful technique of playing and repeating audio clips for perfect pronunciation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
          <FeedbackButton />
        </AuthProvider>
      </body>
    </html>
  );
}
