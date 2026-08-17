import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MainWrapper from "@/components/MainWrapper";
import GlobalShadow from "@/components/GlobalShadow";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ValleOS Dashboard",
  description: "Personal OS and Shadow AI Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#000000] text-[#ededed]`}
      >
        <Sidebar />
        <Topbar />
        
        {/* Main Content Area (animates with Sidebar) */}
        <MainWrapper>
          {children}
        </MainWrapper>

        <CommandPalette />
        <GlobalShadow />
      </body>
    </html>
  );
}



