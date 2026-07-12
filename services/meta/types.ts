export interface Meta {
  genres: string[];
  year: number;
  synopsis: string;
  poster_url?: string;
}

export type ProviderType = "movie" | "tv" | "music" | "book";
