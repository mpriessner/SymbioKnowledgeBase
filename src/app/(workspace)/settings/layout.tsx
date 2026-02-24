import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <SettingsSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="content-pad py-8 max-w-3xl">
          {children}
        </div>
      </main>
    </div>
  );
}
