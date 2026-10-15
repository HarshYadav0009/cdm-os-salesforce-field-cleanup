"use client";

import { NAV_ITEMS, DEFAULT_NAV_ID } from "./navigation"; // ← value only
import type { NavId } from "./navigation"; // ← type only
import DependencyViewer from "../DependencyViewer/DependencyViewerPage";
import FieldTools from "../FieldTools/FieldToolsPage";

interface RightSideSectionProps {
  activePage: NavId;
  dependencyViewerVisited: boolean;
  fieldToolsVisited: boolean;
  inspectionTarget: { object: string; field: string; revision: number };
  onInspectField: (object: string, field: string) => void;
}

export default function RightSideSection({
  activePage,
  dependencyViewerVisited,
  fieldToolsVisited,
  inspectionTarget,
  onInspectField,
}: RightSideSectionProps) {
  const isDependencyViewer = activePage === "DependencyViewer";
  const isFieldTools = activePage === "FieldTools";
  const item =
    NAV_ITEMS.find((n) => n.id === activePage) ??
    NAV_ITEMS.find((n) => n.id === DEFAULT_NAV_ID)!;

  const Page = item.Component;

  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-[#080d18] p-3 text-white sm:p-5 lg:p-7">
      {dependencyViewerVisited && (
        <div hidden={!isDependencyViewer} aria-hidden={!isDependencyViewer}>
          <DependencyViewer
            key={inspectionTarget.revision}
            initialObject={inspectionTarget.object}
            initialField={inspectionTarget.field}
          />
        </div>
      )}
      {fieldToolsVisited && (
        <div hidden={!isFieldTools} aria-hidden={!isFieldTools}>
          <FieldTools onInspect={onInspectField} />
        </div>
      )}
      {!isDependencyViewer && !isFieldTools && <Page />}
    </section>
  );
}
