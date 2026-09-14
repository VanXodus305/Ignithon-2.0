import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const conthrax = localFont({
  src: "../../public/fonts/Conthrax-SemiBold.otf",
  variable: "--font-conthrax",
  display: "swap",
  weight: "600",
});

export const metadata = {
  title: "Ignithon 2.0 OC Portal",
  description: "A portal for the Ignithon 2.0 Organizing Committee to manage and track event-related tasks and information.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geistSans.variable + " " + geistMono.variable + " " + conthrax.variable + " h-full antialiased"}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
