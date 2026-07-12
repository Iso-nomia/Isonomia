import Modal from "@/components/modals/Modal";
import RealtimeFeed from "@/components/shared/RealtimeFeed";
import { fetchFeedPosts } from "@/lib/actions/feed.actions";
import { getUserFromCookies } from "@/lib/serverutils";
import { onCLS } from 'web-vitals';
import WebVitals from "../WebVitals";
import PublicLanding from "@/components/public/PublicLanding";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const HOME_TITLE =
  "Isonomia — store, cite, and check the reasoning behind a conclusion";
const HOME_DESCRIPTION =
  "Isonomia is open-source software for storing, citing, and checking the reasoning behind a conclusion. It turns an argument into structured, verifiable data instead of prose — with provenance, the strongest known objection, and whether it has survived challenge.";
const OG_IMAGE_URL = `${BASE_URL}/api/og/home`;

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    siteName: "Isonomia",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Isonomia — store, cite, and check the reasoning behind a conclusion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};
// onCLS(console.log);

// Force this page to be rendered dynamically on every request
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUserFromCookies();

  // Logged-out visitors (and crawlers / LLMs) get a crawlable public
  // landing page instead of a hard redirect to /login.
  if (!user) {
    return <PublicLanding />;
  }

  const posts = await fetchFeedPosts();
  const USE_SCROLL_ANIMATION = false;

  return (
    <div>
           <WebVitals />  
      <Modal />
      {posts.length === 0 ? (
        <p className="no-result">Nothing found</p>
      ) : (
        <RealtimeFeed
          initialPosts={posts}
          initialIsNext={false}
          roomId="global"
          postTypes={[]}
          currentUserId={user.userId ?? undefined}
          animated={USE_SCROLL_ANIMATION}
        />
      )}
    </div>
  );
}
