import { Sidebar } from "@/components/workspace/Sidebar";
import { BreadcrumbsWrapper } from "@/components/workspace/BreadcrumbsWrapper";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { QuickSwitcher } from "@/components/search/QuickSwitcher";
import { EnhancedSearchWrapper } from "@/components/search/EnhancedSearchWrapper";
import { AIChatButton } from "@/components/ai/AIChatButton";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <main className="workspace-main flex-1 min-w-0 flex flex-col">
          <BreadcrumbsWrapper />
          {children}
        </main>
      </div>
      {/* Quick Switcher (global Cmd/Ctrl+K overlay) */}
      <QuickSwitcher />
      {/* Enhanced Search (global Cmd/Ctrl+Shift+F overlay) */}
      <EnhancedSearchWrapper />
      {/* AI Chat Assistant (floating button + popup) */}
      <AIChatButton />
    </QueryProvider>
  );
}
