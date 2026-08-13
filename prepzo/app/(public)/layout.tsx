import { PublicBar } from "@/components/public/PublicBar";

export default function PublicToolsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="public-page min-h-screen">
      <PublicBar />
      {children}
    </div>
  );
}
