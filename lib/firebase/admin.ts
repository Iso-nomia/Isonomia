import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { serverConfig } from "./config";

let adminApp: App;

function getAdminApp(): App {
  if (!adminApp) {
    const existing = getApps();
    adminApp =
      existing.length > 0
        ? existing[0]
        : initializeApp({ credential: cert(serverConfig.serviceAccount) });
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
