export interface AppRoute {
  readonly description: string;
  readonly label: string;
  readonly path: string;
}

export const APP_ROUTES = [
  {
    path: "/",
    label: "Home",
    description: "The Caissa home experience has not been implemented yet.",
  },
  {
    path: "/play",
    label: "Play",
    description: "Chess gameplay has not been implemented yet.",
  },
  {
    path: "/review",
    label: "Review",
    description: "Post-game review has not been implemented yet.",
  },
  {
    path: "/history",
    label: "History",
    description: "Local game history has not been implemented yet.",
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Application settings have not been implemented yet.",
  },
] as const satisfies readonly AppRoute[];
