"use client";

import { createContext, useContext, useEffect, useState } from "react";

const DEFAULT_SITE_NAME = "CrustyHelpdesk";

interface SiteSettingsContextValue {
  siteName: string;
  refreshSiteSettings: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  siteName: DEFAULT_SITE_NAME,
  refreshSiteSettings: () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);

  function fetchSettings() {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.siteName) setSiteName(data.siteName);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ siteName, refreshSiteSettings: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
