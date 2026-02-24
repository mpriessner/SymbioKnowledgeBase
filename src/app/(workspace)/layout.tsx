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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <BreadcrumbsWrapper />
          {children}
        </main>
        {/* Quick Switcher (global Cmd/Ctrl+K overlay) */}
        <QuickSwitcher />
        {/* Enhanced Search (global Cmd/Ctrl+Shift+F overlay) */}
        <EnhancedSearchWrapper />
        {/* AI Chat Assistant (floating button + popup) */}
        <AIChatButton />
      </div>
    </QueryProvider>
  );
}
