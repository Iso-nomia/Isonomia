import { getUserFromCookies } from "@/lib/serverutils";
import { Button } from "../ui/button";
import Link from "next/link";
import { fetchUserAttributes } from "@/lib/actions/userattributes.actions";
import { fetchUser } from "@/lib/actions/user.actions";
import { format } from "date-fns";


interface Props {
  currentUserId: bigint;
  accountId: bigint;
}

const AboutTab = async ({ currentUserId, accountId }: Props) => {

  const user = await getUserFromCookies();
  if (!user) return null;

  const attributes =
    (await fetchUserAttributes({ userId: accountId })) || null;
  const profile = await fetchUser(accountId);

  const categories = [
    {
      label: "Interests",
      values: attributes?.interests || [],
    },
    {
      label: "Hobbies",
      values: attributes?.hobbies || [],
    },
    {
      label: "Communities",
      values: attributes?.communities || [],
    },
    {
      label: "Location",
      values: attributes?.location ? [attributes.location] : [],
    },
    {
      label: "Birthday",
      values: attributes?.birthday
        ? [format(new Date(attributes.birthday), "yyyy-MM-dd")]
        : [],
    },
    {
      label: "Profession",
      values: attributes?.birthday
        ? [format(new Date(attributes.birthday), "yyyy-MM-dd")]
        : [],
    },
    {
      label: "Artists",
      values: attributes?.artists || [],
    },
    {
      label: "Albums",
      values: attributes?.albums || [],
    },
    {
      label: "Songs",
      values: attributes?.songs || [],
    },
    {
      label: "Movies",
      values: attributes?.movies || [],
    },
    {
      label: "Books",
      values: attributes?.books || [],
    },
    {
      label: "Podcasts",
      values: attributes?.books || [],
    },


  ];

  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {categories.map((cat) => (
        <div
          key={cat.label}
          className="border border-light-3 rounded-md p-4 bg-light-2 bg-opacity-30"
        >
          <h3 className="text-base-semibold mb-2 text-black">{cat.label}</h3>
          {cat.values.length > 0 ? (
            <ul className="list-disc pl-4 text-black text-base-light space-y-1">
              {cat.values.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="text-base-light text-light-3">No {cat.label.toLowerCase()} added</p>
          )}
        </div>
      ))}
    </div>
  );

  const bioSection = profile?.bio ? (
    <p className="mt-4 text-left text-black whitespace-pre-wrap">{profile.bio}</p>
  ) : null;

  if (BigInt(currentUserId) === BigInt(accountId)) {
    return (
      <main className="items-center justify-center text-center">
        <Link href={`/profile/${accountId}/customize`}>
          <button className="tab-button mt-5 text-[1.2rem] bg-white bg-opacity-20 text-black w-fit rounded-xl px-5 tracking-wide py-3 mb-6">
            Customize Profile
          </button>
        </Link>
        <hr></hr>

        {grid}
      </main>
    );
  }

  return <main className="text-center">{bioSection}{grid}</main>;
};


export default AboutTab;
