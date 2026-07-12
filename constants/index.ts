export const sidebarLinks = [
  {
    imgURL: "/assets/home-helsinki.svg",
    route: "/",
    label: "Home",
  },
  {
    imgURL: "/assets/search-helsinki.svg",
    route: "/search",
    label: "Search",
  },
  {
    imgURL: "/assets/notifications-none.svg",
    route: "/notifications",
    label: "Notifications",
  },
  {
    imgURL: "/assets/user-helsinki.svg",
    route: "/profile",
    label: "Profile",
  },
  {
    imgURL: "/assets/logo-white.svg",
    route: "/room/global",
    label: "Crypt",
  },
  {
    imgURL: "/assets/create-new.svg",
    route: "/create-room",
    label: "Create Room",
  },
];

export const profileTabs = [
  { value: "posts", label: "Posts", icon: "/assets/posts.svg" },
  { value: "tagged", label: "Tagged", icon: "/assets/tag.svg" },
  { value: "messages", label: "Messages", icon: "/assets/chat--launch.svg" },

  { value: "friends", label: "Friends", icon: "/assets/multiple-users.svg" },

  { value: "about", label: "About", icon: "/assets/user-circle.svg" },
];

export const COLORS = ["#DC2626", "#D97706", "#059669", "#7C3AED", "#DB2777"];

export const MOUSE_EVENT = "cursor";
export const EMOJI_EVENT = "reaction";
export const TEXT_UPDATE_EVENT = "text-update";
export const WORKFLOW_CHANNEL = "workflow-updates";
export const WORKFLOW_CURRENT_EVENT = "workflow-current";
export const WORKFLOW_EXECUTED_EVENT = "workflow-executed";
export const WORKFLOW_LOG_EVENT = "workflow-log";

// Global flag for demo mode

