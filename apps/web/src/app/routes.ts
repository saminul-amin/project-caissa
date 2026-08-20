export interface AppRoute {
  readonly description?: string;
  readonly label: string;
  readonly path: string;
}

export const APP_ROUTES = [
  {
    path: "/",
    label: "Home",
  },
  {
    path: "/play/new",
    label: "Play",
  },
  {
    path: "/history",
    label: "History",
    description: "Finished games saved in this browser.",
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Appearance, sound, and your local data.",
  },
] as const satisfies readonly AppRoute[];
