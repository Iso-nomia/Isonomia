import { UserAttributes } from "@prisma/client";
import { upsertUserAttributes } from "./actions/userattributes.actions";
import { updateUserBio } from "./actions/user.actions";

const OMDB_API_KEY = "c971c02c";
const discogsToken = "cuqwVeLuoiKZsMfpWDLDPeTIjviOBgJnlvHELjse";

export const interestList: OptionType[] = [
  { value: "rock_climbing", label: "Rock Climbing" },
  { value: "skydiving", label: "Skydiving" },
  { value: "scuba_diving", label: "Scuba Diving" },
  { value: "white_water_rafting", label: "White Water Rafting" },
  { value: "paragliding", label: "Paragliding" },
  { value: "spelunking", label: "Spelunking" },
  { value: "car_restoration", label: "Car Restoration" },
  { value: "car_detailing", label: "Car Detailing" },
  { value: "auto_racing", label: "Auto Racing" },
  { value: "off_roading", label: "Off-Roading" },
  { value: "car_photography", label: "Car Photography" },
  { value: "car_collecting", label: "Car Collecting" },
  { value: "autocross", label: "Autocross" },
  { value: "hiking", label: "Hiking" },
  { value: "kayaking", label: "Kayaking/Canoeing" },
  { value: "stargazing", label: "Stargazing" },
  { value: "cycling", label: "Cycling" },
  { value: "nature_walks", label: "Nature Walks" },
  { value: "biking", label: "Biking" },
  { value: "picnicking", label: "Picnicking" },
  { value: "camping", label: "Camping" },
  { value: "geocaching", label: "Geocaching" },
  { value: "parkour", label: "Parkour" },
  { value: "free_running", label: "Free Running" },
  { value: "skateboarding", label: "Skateboarding" },
  { value: "rollerblading", label: "Rollerblading/Roller Skating" },
  { value: "motocross", label: "Motocross" },
  { value: "skiing", label: "Skiing" },
  { value: "kite_flying", label: "Kite Flying" },
  { value: "beach_running", label: "Beach Running" },
  { value: "beach_cleanup", label: "Beach Cleanup" },
  { value: "surfing", label: "Surfing" },
  { value: "beach_yoga", label: "Beach Yoga" },
  { value: "beach_photography", label: "Beach Photography" },
  { value: "dancing", label: "Dancing" },
  { value: "trampoline_jumping", label: "Trampoline Jumping" },
  { value: "kickboxing", label: "Kickboxing" },
  { value: "zumba", label: "Zumba" },
  { value: "swimming", label: "Swimming" },
];

export const communityList: OptionType[] = [
  { value: "photography_club", label: "Photography Club" },
  { value: "book_club", label: "Book Club" },
  { value: "sports_fans", label: "Sports Fans" },
  { value: "gaming", label: "Gaming" },
  { value: "yoga_group", label: "Yoga Group" },
  { value: "running_club", label: "Running Club" },
  { value: "cooking", label: "Cooking" },
  { value: "chess_club", label: "Chess Club" },
  { value: "writers", label: "Writers" },
  { value: "artists", label: "Artists" },
  { value: "musicians", label: "Musicians" },
  { value: "parents", label: "Parents" },
  { value: "travelers", label: "Travelers" },
  { value: "foodies", label: "Foodies" },
  { value: "film_buff", label: "Film Buffs" },
  { value: "startups", label: "Startups" },
  { value: "open_source", label: "Open Source" },
  { value: "nature_conservation", label: "Nature Conservation" },
  { value: "volunteers", label: "Volunteers" },
];

export function addInterest(label: string): OptionType {
  const value = label.toLowerCase().replace(/\s+/g, "_");
  let option = interestList.find(
    (i) => i.label.toLowerCase() === label.toLowerCase()
  );
  if (!option) {
    option = { value, label };
    interestList.push(option);
  }
  return option;
}

export interface OptionType {
  value: string;
  label: string;
}

export async function fetchMovies(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://www.omdbapi.com/?s=${query}&apikey=${OMDB_API_KEY}`
    );
    const data = await response.json();
    if (data.Search && Array.isArray(data.Search)) {
      const movies = data.Search.map((movie: any) => ({
        value: movie.imdbID,
        label: movie.Title,
        year: parseInt(movie.Year),
      }));
      return movies;
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching movies:", error);
    return [];
  }
}

export async function fetchBooks(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    if (data.docs && Array.isArray(data.docs)) {
      const books = data.docs.map((doc: any) => ({
        value: doc.key,
        label: `${doc.title}${doc.author_name && doc.author_name.length ? ` by ${doc.author_name[0]}` : ""}`,
      }));

      const uniqueBooks = books.filter(
        (book: any, index: number, self: any) =>
          index === self.findIndex((b: any) => b.label === book.label)
      );

      return uniqueBooks;
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching books:", error);
    return [];
  }
}

export async function fetchAlbums(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(
        query
      )}&type=release`,
      {
        headers: {
          Authorization: `Discogs token=${discogsToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      const albums = data.results.map((album: any) => ({
        value: album.id.toString(),
        label: album.title,
      }));

      // Remove duplicates based on the album label (title)
      const uniqueAlbums = albums.filter(
        (album: any, index: any, self: any) =>
          index === self.findIndex((a: any) => a.label === album.label)
      );

      return uniqueAlbums;
    } else {
      return [];
    }
  } catch (error: any) {
    console.error("Error fetching albums:", error);
    return [];
  }
}

export async function fetchArtists(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(
        query
      )}&type=artist`,
      {
        headers: {
          Authorization: `Discogs token=${discogsToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      const artists = data.results.map((artist: any) => ({
        value: artist.id.toString(),
        label: artist.title,
      }));

      // Remove duplicates based on the artist label (name)
      const uniqueArtists = artists.filter(
        (artist: any, index: any, self: any) =>
          index === self.findIndex((a: any) => a.label === artist.label)
      );

      return uniqueArtists;
    } else {
      return [];
    }
  } catch (error: any) {
    console.error("Error fetching artists:", error);
    return [];
  }
}

export async function fetchTracks(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(
        query
      )}&type=track`,
      {
        headers: {
          Authorization: `Discogs token=${discogsToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      const tracks = data.results.map((track: any) => ({
        value: track.id.toString(),
        label: track.title,
      }));

      // Remove duplicates based on the track label (title)
      const uniqueTracks = tracks.filter(
        (track: any, index: any, self: any) =>
          index === self.findIndex((t: any) => t.label === track.label)
      );
      return uniqueTracks;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error fetching tracks:", error);
    return [];
  }
}

export async function fetchEvents(query: string): Promise<OptionType[]> {
  const stub = [
    { value: "festival", label: "Local Festival" },
    { value: "meetup", label: "Community Meetup" },
    { value: "conference", label: "Tech Conference" },
  ];
  return stub.filter((e) =>
    e.label.toLowerCase().includes(query.toLowerCase())
  );
}

export async function fetchTVShows(query: string): Promise<OptionType[]> {
  try {
    const response = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    if (Array.isArray(data)) {
      const shows = data.map((item: any) => ({
        value: item.show.id.toString(),
        label: item.show.name,
      }));
      return shows.filter(
        (show: any, idx: number, self: any) =>
          idx === self.findIndex((s: any) => s.label === show.label)
      );
    }
    return [];
  } catch (error) {
    console.error("Error fetching tv shows:", error);
    return [];
  }
}

export async function fetchPodcasts(query: string): Promise<OptionType[]> {
  const stub = [
    { value: "tech_talk", label: "Tech Talk" },
    { value: "daily_news", label: "Daily News" },
    { value: "comedy_hour", label: "Comedy Hour" },
  ];
  return stub.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase())
  );
}

export async function fetchInterests(query: string): Promise<OptionType[]> {
  return interestList.filter((interest) =>
    interest.label.toLowerCase().includes(query.toLowerCase())
  );
}

export async function fetchCommunities(query: string): Promise<OptionType[]> {
  return communityList.filter((community) =>
    community.label.toLowerCase().includes(query.toLowerCase())
  );
}

export function convertListToSelectables(interests?: string[]) {
  if (!interests || interests.length === 0) {
    return [] as OptionType[];
  }
  return interests.map(
    (interest) =>
      ({
        label: interest,
        value: interest,
      } as OptionType)
  );
}

export function convertSelectablesToList(selectables: OptionType[]) {
  return selectables.map((selectable) => selectable.label);
}

export function submitEdits(
  selectableType:
    | "INTERESTS"
    | "HOBBIES"
    | "ALBUMS"
    | "MOVIES"
    | "TRACKS"
    | "ARTISTS"
    | "BOOKS"
    | "COMMUNITIES"
    | "EVENTS"
    | "TV_SHOWS"
    | "PODCASTS",
  selectables: OptionType[],
  userAttributes: UserAttributes,
  path: string
) {
  switch (selectableType) {
    case "INTERESTS":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          interests: convertSelectablesToList(selectables),
        },
        path,
      });
    case "HOBBIES":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          hobbies: convertSelectablesToList(selectables),
        },
        path,
      });
    case "ALBUMS":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          albums: convertSelectablesToList(selectables),
        },
        path,
      });
    case "MOVIES":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          movies: convertSelectablesToList(selectables),
        },
        path,
      });
    case "BOOKS":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          books: convertSelectablesToList(selectables),
        },
        path,
      });
    case "TRACKS":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          songs: convertSelectablesToList(selectables),
        },
        path,
      });
    case "ARTISTS":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          artists: convertSelectablesToList(selectables),
        },
        path,
      });
    case "COMMUNITIES":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          communities: convertSelectablesToList(selectables),
        },
        path,
      });
    case "EVENTS":
      return upsertUserAttributes({
        userAttributes: {
          ...(userAttributes as any),
          events: convertSelectablesToList(selectables),
        },
        path,
      });
    case "TV_SHOWS":
      return upsertUserAttributes({
        userAttributes: {
          ...(userAttributes as any),
          tv_shows: convertSelectablesToList(selectables),
        },
        path,
      });
    case "PODCASTS":
      return upsertUserAttributes({
        userAttributes: {
          ...(userAttributes as any),
          podcasts: convertSelectablesToList(selectables),
        },
        path,
      });
    default:
      console.error("Nothing to update");
  }
}

export function submitFieldEdits(
  field: "LOCATION" | "BIRTHDAY",
  value: string,
  userAttributes: UserAttributes,
  path: string
) {
  switch (field) {
    case "LOCATION":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          location: value,
        },
        path,
      });
    case "BIRTHDAY":
      return upsertUserAttributes({
        userAttributes: {
          ...userAttributes,
          birthday: new Date(value),
        },
        path,
      });
    default:
      console.error("Nothing to update");
  }
}

export function submitBioEdit(bio: string, path: string) {
  return updateUserBio({ bio, path });
}
