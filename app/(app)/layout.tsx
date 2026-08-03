import { Footer } from "@/components/footer";
import { RebrandBanner } from "@/components/rebrand-banner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RebrandBanner />
      {children}
      <Footer />
    </>
  );
}
