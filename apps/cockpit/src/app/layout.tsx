import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Zero — cockpit",
  description: "Approve, edit, or kill parked drafts. The model cannot send.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('station-theme');if(t&&t!=='system')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
        <link rel="stylesheet" href="/station.theme.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
