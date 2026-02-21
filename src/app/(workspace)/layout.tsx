import { Sidebar } from "@/components/workspace/Sidebar";
import { QueryProvider } from "@/components/providers/QueryProvider";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </QueryProvider>
  );
}
