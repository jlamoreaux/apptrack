import { Footer } from "@/components/footer";
import { RebrandBanner } from "@/components/rebrand-banner";
import { GuestCompImport } from "@/components/careerotter/comp/guest-import";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RebrandBanner />
      <GuestCompImport />
      {children}
      <Footer />
    </>
  );
}
