import { Footer } from "@/components/footer";
import { WebMcpProvider } from "@/components/agents/webmcp-provider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Footer />
      {/* Exposes the public pages' actions to in-browser agents. Renders nothing. */}
      <WebMcpProvider />
    </>
  );
}
