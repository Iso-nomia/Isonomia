"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FancyMultiSelect } from "@/components/ui/multiselect";
import {
  convertListToSelectables,
  fetchAlbums,
  fetchArtists,
  fetchInterests,
  fetchCommunities,
  addInterest,
  fetchMovies,
  fetchBooks,
  fetchEvents,
  fetchTVShows,
  fetchPodcasts,
  fetchTracks,
  submitEdits,
  submitFieldEdits,
  submitBioEdit,
} from "@/lib/MultiSelectFunctions";
import { UserAttributes } from "@prisma/client";
import { usePathname } from "next/navigation";
import React, { useState } from 'react';


interface Props {
  userAttributes: UserAttributes;
  currentBio?: string;
  initialOpen?: boolean;
}

export default function CustomButtons({ userAttributes, currentBio, initialOpen }: Props) {
  const [isAboutOpen, setAboutOpen] = useState(false);
  const [isBirthdayOpen, setBirthdayOpen] = useState(false);
  const [isLocationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState(userAttributes.location || "");
  const [isInterestsOpen, setInterestsOpen] = useState(initialOpen || false);
  const [isHobbiesOpen, setHobbiesOpen] = useState(false);
  const [isCommunitiesOpen, setCommunitiesOpen] = useState(false);
  const [isEventsOpen, setEventsOpen] = useState(false);
  const [isMoviesOpen, setMoviesOpen] = useState(false);
  const [isTVOpen, setTVOpen] = useState(false);
  const [isBooksOpen, setBooksOpen] = useState(false);
  const [isPodcastsOpen, setPodcastsOpen] = useState(false);
  const [isArtistsOpen, setArtistsOpen] = useState(false);
  const [isAlbumsOpen, setAlbumsOpen] = useState(false);
  const [isTracksOpen, setTracksOpen] = useState(false);
  const [birthday, setBirthday] = useState(
    userAttributes.birthday
      ? new Date(userAttributes.birthday).toISOString().split("T")[0]
      : ""
  );
  const path = usePathname() ?? "";
  const [message, setMessage] = useState(currentBio ?? "");
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  return (
    <div className="absolute flex flex-wrap grid-auto-row-dense w-fit	max-w-[70rem] items-start justify-start gap-10  mt-24  ">
      <div className="relative grid p-5 gap-3 w-fit  border-[1px] border-sky-400 rounded-xl pb-7 text-black  font-semibold">
       <h1 className="text-[1.2rem] ">
        {"Bio"}
        </h1> 

        {/* About Modal */}
        <Dialog open={isAboutOpen} onOpenChange={setAboutOpen}>
          <DialogTrigger asChild>
            <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              About Me
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-slate-300 border-blue border-[1px] max-w-[50rem] max-h-[38rem]	">
            <DialogHeader className="dialog-header text-center text-black tracking-wide	">
              <b className="text-center "> Write Anything Here</b>
            </DialogHeader>
            <hr />

            <div className=" bg-transparent border border-white rounded-md px-3 pt-6 pb-6 mt-3 mb-3 ">
            <form className="items-center flex flex-1 justify-center rounded-md shadow-none">
          <label htmlFor="message"></label>
          <textarea
            id="message"
            value={message} // Controlled component: value tied to state
            onChange={handleChange} // Update state on change
            rows={8} // Set initial visible rows
            cols={90} // Set initial visible columns
            placeholder="Type your message here..."
            className="text-[1rem] bg-transparent border-[1px] border-white rounded-lg shadow-none "
          />
        </form>            </div>
            <hr />
            <div className="flex gap-20 items-center justify-center ">
              <DialogClose
                id="aboutme"
                type="submit"
                className={`likebutton text-[1.2rem] tracking-[2px] text-center px-4 py-1 border-blue border-[.5px]`}
                onClick={() => submitBioEdit(message, path)}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`likebutton text-[1.2rem] tracking-[2px] text-center px-4 py-1 border-blue border-[.5px]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Birthday Modal */}
        <Dialog open={isBirthdayOpen} onOpenChange={setBirthdayOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Birthday
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Birthday</h2>
            <DialogHeader className="dialog-header text-white tracking-wide	">
              <b>When Is Your Birthday?</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6 pb-[4rem] mt-3 mb-3 ">
              <Input
                type="date"
                value={birthday}
                onChange={(e) => {
                  const value = e.target.value;
                  setBirthday(value);
                  
                  submitFieldEdits("BIRTHDAY", value, userAttributes, path);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitFieldEdits("BIRTHDAY", birthday, userAttributes, path);
                  }
                }}
              />
            </div>
            <hr />
            <div className="flex gap-4 ">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Location Modal */}
        <Dialog open={isLocationOpen} onOpenChange={setLocationOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Location
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Location</h2>
            <DialogHeader className="dialog-header text-white tracking-wide	">
              <b>Enter Your Location</b>
            </DialogHeader>
            <hr />
            <div className="bg-black border border-white rounded-md px-3 pt-6 pb-[4rem] mt-3 mb-3 ">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitFieldEdits("LOCATION", e.currentTarget.value, userAttributes, path);
                  }
                }}
                onBlur={() => submitFieldEdits("LOCATION", location, userAttributes, path)}
                placeholder="Your location"
              />
            </div>
            <hr />
            <div className="flex gap-4 ">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative grid p-5 gap-3 w-fit  border-[1px] border-sky-400 rounded-xl pb-7 text-black  font-semibold">
      <h1 className="text-[1.2rem]">
        {"Activities"}
        </h1> 
        {/* Interests Modal */}
        <Dialog open={isInterestsOpen} onOpenChange={setInterestsOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Interests
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Interests</h2>
            <DialogHeader className="dialog-header text-white tracking-wide	">
              <b> What are you into?</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6 pb-[4rem] mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchInterests}
                initialSelected={convertListToSelectables(
                  userAttributes.interests
                )}
                submitEdits={(selectables) =>
                  submitEdits("INTERESTS", selectables, userAttributes, path)
                }
         
                allowNew
                onCreateOption={addInterest}
              />
            </div>
            <hr />
            <div className="flex gap-4 ">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hobbies Modal */}
        <Dialog open={isHobbiesOpen} onOpenChange={setHobbiesOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Hobbies
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Hobbies</h2>
            <DialogHeader className="dialog-header text-white tracking-wide	">
              <b> What do you enjoy doing?</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6 pb-[4rem] mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchInterests}
                initialSelected={convertListToSelectables(
                  userAttributes.hobbies
                )}
                submitEdits={(selectables) =>
                  submitEdits("HOBBIES", selectables, userAttributes, path)
                }
                allowNew
                onCreateOption={addInterest}
              />
            </div>
            <hr />
            <div className="flex gap-4 ">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Communities Modal */}
        <Dialog open={isCommunitiesOpen} onOpenChange={setCommunitiesOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Communities
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Communities</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> What communities are you a part of?</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchCommunities}
                initialSelected={convertListToSelectables(
                  userAttributes.communities
                )}
                submitEdits={(selectables) =>
                  submitEdits("COMMUNITIES", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Events Modal */}
        <Dialog open={isEventsOpen} onOpenChange={setEventsOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Events
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Events</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Where are you headed this weekend?</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchEvents}
                initialSelected={convertListToSelectables((userAttributes as any).events)}
                submitEdits={(selectables) =>
                  submitEdits("EVENTS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative grid p-5 gap-3 w-fit  border-[1px] border-sky-400 rounded-xl pb-7 text-black  font-semibold">
      <h1 className="text-[1.2rem]">
        {"Media"}
        </h1> 
        {/* Movies Modal */}
        <Dialog open={isMoviesOpen} onOpenChange={setMoviesOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Movies
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Movies</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Films</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchMovies}
                initialSelected={convertListToSelectables(
                  userAttributes.movies
                )}
                submitEdits={(selectables) =>
                  submitEdits("MOVIES", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* TV Modal */}
        <Dialog open={isTVOpen} onOpenChange={setTVOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Television
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Television</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite TV Shows</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchTVShows}
                initialSelected={convertListToSelectables((userAttributes as any).tv_shows)}
                submitEdits={(selectables) =>
                  submitEdits("TV_SHOWS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>
              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Books Modal */}
        <Dialog open={isBooksOpen} onOpenChange={setBooksOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Books
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Books</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Books</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchBooks}
                initialSelected={convertListToSelectables(userAttributes.books)}
                submitEdits={(selectables) =>
                  submitEdits("BOOKS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="enterbooks"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Podcasts Modal */}
        <Dialog open={isPodcastsOpen} onOpenChange={setPodcastsOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Podcasts
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Podcasts</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Podcasts</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchPodcasts}
                initialSelected={convertListToSelectables((userAttributes as any).podcasts)}
                submitEdits={(selectables) =>
                  submitEdits("PODCASTS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entermovie"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>
              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative grid p-5 gap-3 w-fit  border-[1px] border-sky-400 rounded-xl pb-7 text-black  font-semibold">
      <h1 className="text-[1.2rem]">
        {"Music"}
        </h1> 
        {/* Artists Modal */}
        <Dialog open={isArtistsOpen} onOpenChange={setArtistsOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Artists
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Artists</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Artists</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchArtists}
                initialSelected={convertListToSelectables(
                  userAttributes.artists
                )}
                submitEdits={(selectables) =>
                  submitEdits("ARTISTS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="enterartists"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Albums Modal */}
        <Dialog open={isAlbumsOpen} onOpenChange={setAlbumsOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Albums
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Albums</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Albums</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchAlbums}
                initialSelected={convertListToSelectables(
                  userAttributes.albums
                )}
                submitEdits={(selectables) =>
                  submitEdits("ALBUMS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="enteralbums"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tracks Modal */}
        <Dialog open={isTracksOpen} onOpenChange={setTracksOpen}>
          <DialogTrigger asChild>
          <Button variant={"customize"} size={"lg"} className="likebutton flex w-full rounded-md hover:likebutton">
              Tracks
            </Button>
          </DialogTrigger>
          <DialogContent className="grid bg-black  max-w-[50rem] max-h-[38rem]	">
            <h2>Tracks</h2>
            <DialogHeader className="dialog-header mt-[-2rem] text-white tracking-wide	">
              <b> Choose Your Favorite Songs</b>
            </DialogHeader>
            <hr />

            <div className="bg-black border border-white rounded-md px-3 pt-6  pb-16  mt-3 mb-3 ">
              <FancyMultiSelect
                fetchMultiselectData={fetchTracks}
                initialSelected={convertListToSelectables(userAttributes.songs)}
                submitEdits={(selectables) =>
                  submitEdits("TRACKS", selectables, userAttributes, path)
                }
              />
            </div>
            <hr />
            <div className="flex gap-4 mb-2 mt-2">
              <DialogClose
                id="entertracks"
                type="submit"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Enter
              </DialogClose>

              <DialogClose
                id="close"
                className={`form-submit-button pl-4 py-1 pr-[1rem]`}
              >
                Close
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
