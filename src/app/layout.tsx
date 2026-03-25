import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/lib/authContext";

export const metadata: Metadata = {
  title: "Sokxay One Plus - Issue Tracker",
  description: "ສັງລວມບັນຫາ ກ່ຽວກັບແອັບ Sokxay One Plus",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
