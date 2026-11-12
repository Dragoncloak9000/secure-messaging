import type { ReactNode } from "react";
import { Martel_Sans } from 'next/font/google'

const martelSans = Martel_Sans({
  weight: "400"
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{margin: 0}} className={martelSans.className}>{children}</body>
    </html>
  );
}
