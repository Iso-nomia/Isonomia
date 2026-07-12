import UserCard from "@/components/cards/UserCard";
import Pagination from "@/components/shared/Pagination";
import Searchbar from "@/components/shared/Searchbar";
import { fetchUsers } from "@/lib/actions/user.actions";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";

async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await getUserFromCookies();
  if (!user?.onboarded) redirect("/onboarding");

  const result = await fetchUsers({
    userId: user.userId!,
    searchString: searchParams.q,
    pageNumber: searchParams?.page ? +searchParams.page : 1,
    pageSize: 25,
  });

  return (
    <section>
      <h1 className="head-text mb-2 mt-[-2rem]">Search</h1>
      <hr className="mb-2"></hr>
      <Searchbar routeType="search" />
      <div className="mt-8 justify-start items-start flex flex-wrap ">
        {result.users.length === 0 ? (
          <p className="no-result">No Users</p>
        ) : (
          <>
            {result.users.map((searchUser) => (
              <UserCard
                key={searchUser.id.toString()}
                userId={searchUser.id}
                name={searchUser.name!}
                username={searchUser.username}
                imgUrl={searchUser.image}
                personType="User"
              />
            ))}
          </>
        )}
      </div>
      <Pagination
        path="search"
        pageNumber={searchParams?.page ? +searchParams.page : 1}
        isNext={result.isNext}
      />
    </section>
  );
}

export default Page;
