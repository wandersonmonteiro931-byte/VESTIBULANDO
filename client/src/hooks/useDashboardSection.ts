import { useCallback, useEffect, useState } from "react";

function sectionFromUrl(defaultSection: string) {
  if (typeof window === "undefined") return defaultSection;
  return new URLSearchParams(window.location.search).get("secao") || defaultSection;
}

export function useDashboardSection(defaultSection: string) {
  const [selectedSection, setSelectedSectionState] = useState(() => sectionFromUrl(defaultSection));

  useEffect(() => {
    const updateFromHistory = () => {
      setSelectedSectionState(sectionFromUrl(defaultSection));
    };
    window.addEventListener("popstate", updateFromHistory);
    return () => window.removeEventListener("popstate", updateFromHistory);
  }, [defaultSection]);

  const setSelectedSection = useCallback((section: string) => {
    setSelectedSectionState(section);

    const url = new URL(window.location.href);
    if (url.searchParams.has("secao")) {
      url.searchParams.delete("secao");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return [selectedSection, setSelectedSection] as const;
}
