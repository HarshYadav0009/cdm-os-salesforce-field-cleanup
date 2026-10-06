"use client";

import { NAV_ITEMS, DEFAULT_NAV_ID } from "./navigation";   // ← value only
import type { NavId } from "./navigation";                  // ← type only

interface RightSideSectionProps {
  activePage: NavId;
}

export default function RightSideSection({
  activePage,
}: RightSideSectionProps) {
  const item =
    NAV_ITEMS.find((n) => n.id === activePage) ??
    NAV_ITEMS.find((n) => n.id === DEFAULT_NAV_ID)!;

  const Page = item.Component;

  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-[#080d18] p-3 text-white sm:p-5 lg:p-7">
      <Page />
    </section>
  );
}