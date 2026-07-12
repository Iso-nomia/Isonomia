import dynamic from "next/dynamic";
const Hub = dynamic(() => import("./ui/Hub"), { ssr: false });
export default function HubPage() { return <Hub />; }
