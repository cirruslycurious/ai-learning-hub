import { NavRail } from "@/components/NavRail";
import { SaveModal } from "@/components/SaveModal";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col lg:flex-row">
      <NavRail />
      <main className="flex-1 lg:ml-14 mb-14 lg:mb-0 overflow-hidden">
        <Outlet />
      </main>
      <SaveModal />
    </div>
  );
}
