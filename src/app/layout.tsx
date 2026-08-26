import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MainWrapper from "@/components/MainWrapper";
import GlobalShadow from "@/components/GlobalShadow";
import PreferencesSync from "@/components/PreferencesSync";
import { ShadowVoiceProvider } from "@/components/shadow/ShadowVoiceProvider";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ValleOS — Personal Intelligence",
  description: "Sistema operativo personal y núcleo de inteligencia Shadow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
      >
        <ShadowVoiceProvider>
          <PreferencesSync />
          <Sidebar />
          <Topbar />
          <MainWrapper>
            {children}
          </MainWrapper>
          <CommandPalette />
          <GlobalShadow />
        </ShadowVoiceProvider>
      </body>
    </html>
  );
}
