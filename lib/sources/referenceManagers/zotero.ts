/**
 * Zotero API Client
 *
 * Full integration with the Zotero API for reference manager sync.
 * Supports:
 * - User and group libraries
 * - Reading/writing items
 * - Incremental sync using library versions
 * - Attachment handling
 *
 * API Docs: https://www.zotero.org/support/dev/web_api/v3/start
 *
 * @module lib/sources/referenceManagers/zotero
 */

const API_BASE = "https://api.zotero.org";

interface ZoteroLibrary {
  type: "user" | "group";
  id: string;
  name: string;
  version: number;
}

interface ZoteroItem {
  key: string;
  version: number;
  library: {
    type: string;
    id: number;
    name: string;
  };
  links: {
    self: { href: string };
    alternate: { href: string };
  };
  meta: {
    creatorSummary?: string;
    parsedDate?: string;
    numChildren?: number;
  };
  data: ZoteroItemData;
}

interface ZoteroItemData {
  key: string;
  version: number;
  itemType: string;
  title?: string;
  creators?: ZoteroCreator[];
  abstractNote?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  date?: string;
  DOI?: string;
  ISSN?: string;
  ISBN?: string;
  url?: string;
  accessDate?: string;
  extra?: string;
  tags?: Array<{ tag: string; type?: number }>;
  collections?: string[];
  relations?: Record<string, string | string[]>;
  dateAdded?: string;
  dateModified?: string;
  parentItem?: string;
  contentType?: string; // for attachments
  filename?: string; // for attachments
  linkMode?: string; // for attachments
}

interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string; // for single-field names
}

interface ZoteroCollection {
  key: string;
  version: number;
  data: {
    key: string;
    name: string;
    parentCollection: string | false;
  };
}

interface ZoteroSearchResponse<T> {
  items: T[];
  totalResults: number;
  libraryVersion: number;
}

interface ZoteroClientOptions {
  apiKey: string;
  libraryType: "user" | "group";
  libraryId: string;
}

/**
 * Zotero API client for reference manager integration
 */
export class ZoteroClient {
  private apiKey: string;
  private libraryType: "user" | "group";
  private libraryId: string;

  constructor(options: ZoteroClientOptions) {
    this.apiKey = options.apiKey;
    this.libraryType = options.libraryType;
    this.libraryId = options.libraryId;
  }

  /**
   * Get base URL for library requests
   */
  private get libraryUrl(): string {
    if (this.libraryType === "user") {
      return `${API_BASE}/users/${this.libraryId}`;
    }
    return `${API_BASE}/groups/${this.libraryId}`;
  }

  /**
   * Make authenticated request to Zotero API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
    parseTotal = false
  ): Promise<{ data: T; libraryVersion: number; totalResults?: number }> {
    const url = path.startsWith("http") ? path : `${this.libraryUrl}${path}`;

    const headers: HeadersInit = {
      "Zotero-API-Key": this.apiKey,
      "Zotero-API-Version": "3",
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zotero API error (${response.status}): ${error}`);
    }

    const libraryVersion = parseInt(
      response.headers.get("Last-Modified-Version") || "0",
      10
    );

    const totalResults = parseTotal
      ? parseInt(response.headers.get("Total-Results") || "0", 10)
      : undefined;

    const data = await response.json();

    return { data, libraryVersion, totalResults };
  }

  /**
   * Verify API key and get user info
   */
  async verifyKey(): Promise<{ userId: string; username: string; access: Record<string, unknown> }> {
    const response = await fetch(`${API_BASE}/keys/${this.apiKey}`, {
      headers: {
        "Zotero-API-Key": this.apiKey,
        "Zotero-API-Version": "3",
      },
    });

    if (!response.ok) {
      throw new Error("Invalid Zotero API key");
    }

    const data = await response.json();
    return {
      userId: String(data.userID),
      username: data.username,
      access: data.access,
    };
  }

  /**
   * Get all accessible libraries
   */
  async getLibraries(): Promise<ZoteroLibrary[]> {
    const keyInfo = await this.verifyKey();
    const libraries: ZoteroLibrary[] = [];

    // User library
    if (this.libraryType === "user") {
      const { data, libraryVersion } = await this.request<{ name: string }>("/");
      libraries.push({
        type: "user",
        id: this.libraryId,
        name: data.name || "My Library",
        version: libraryVersion,
      });
    }

    // Group libraries (if accessible)
    try {
      const { data: groups } = await this.request<Array<{ id: number; data: { name: string }; version: number }>>(
        `${API_BASE}/users/${keyInfo.userId}/groups`
      );
      for (const group of groups) {
        libraries.push({
          type: "group",
          id: String(group.id),
          name: group.data.name,
          version: group.version,
        });
      }
    } catch {
      // Groups not accessible, that's fine
    }

    return libraries;
  }

  /**
   * Get current library version
   */
  async getLibraryVersion(): Promise<number> {
    const response = await fetch(`${this.libraryUrl}/items?limit=0`, {
      method: "HEAD",
      headers: {
        "Zotero-API-Key": this.apiKey,
        "Zotero-API-Version": "3",
      },
    });

    return parseInt(response.headers.get("Last-Modified-Version") || "0", 10);
  }

  /**
   * Get all collections in the library
   */
  async getCollections(): Promise<ZoteroCollection[]> {
    const { data } = await this.request<ZoteroCollection[]>("/collections");
    return data;
  }

  /**
   * Get items from library
   */
  async getItems(options: {
    collectionId?: string;
    sinceVersion?: number;
    start?: number;
    limit?: number;
    itemType?: string;
  } = {}): Promise<ZoteroSearchResponse<ZoteroItem>> {
    const params = new URLSearchParams();

    if (options.sinceVersion !== undefined) {
      params.set("since", String(options.sinceVersion));
    }
    if (options.start !== undefined) {
      params.set("start", String(options.start));
    }
    if (options.limit !== undefined) {
      params.set("limit", String(Math.min(options.limit, 100)));
    }
    if (options.itemType) {
      params.set("itemType", options.itemType);
    }

    // Exclude attachments and notes by default
    if (!options.itemType) {
      params.set("itemType", "-attachment || -note");
    }

    const path = options.collectionId
      ? `/collections/${options.collectionId}/items`
      : "/items";

    const { data, libraryVersion, totalResults } = await this.request<ZoteroItem[]>(
      `${path}?${params}`,
      {},
      true
    );

    return {
      items: data,
      totalResults: totalResults || data.length,
      libraryVersion,
    };
  }

  /**
   * Get a single item by key
   */
  async getItem(key: string): Promise<ZoteroItem> {
    const { data } = await this.request<ZoteroItem>(`/items/${key}`);
    return data;
  }

  /**
   * Create a new item
   */
  async createItem(itemData: Partial<ZoteroItemData>): Promise<ZoteroItem> {
    const { data } = await this.request<{ successful: Record<string, ZoteroItem> }>(
      "/items",
      {
        method: "POST",
        body: JSON.stringify([itemData]),
      }
    );

    const created = Object.values(data.successful)[0];
    if (!created) {
      throw new Error("Failed to create item");
    }

    return created;
  }

  /**
   * Update an existing item
   */
  async updateItem(
    key: string,
    version: number,
    itemData: Partial<ZoteroItemData>
  ): Promise<ZoteroItem> {
    const { data } = await this.request<ZoteroItem>(`/items/${key}`, {
      method: "PATCH",
      headers: {
        "If-Unmodified-Since-Version": String(version),
      },
      body: JSON.stringify(itemData),
    });

    return data;
  }

  /**
   * Delete an item
   */
  async deleteItem(key: string, version: number): Promise<void> {
    await this.request(`/items/${key}`, {
      method: "DELETE",
      headers: {
        "If-Unmodified-Since-Version": String(version),
      },
    });
  }

  /**
   * Search items by query
   */
  async searchItems(query: string, options: { limit?: number } = {}): Promise<ZoteroItem[]> {
    const params = new URLSearchParams({
      q: query,
      qmode: "everything",
      limit: String(options.limit || 25),
      itemType: "-attachment || -note",
    });

    const { data } = await this.request<ZoteroItem[]>(`/items?${params}`);
    return data;
  }

  /**
   * Get items modified since a specific version
   */
  async getModifiedItems(sinceVersion: number): Promise<{
    items: ZoteroItem[];
    deletedKeys: string[];
    libraryVersion: number;
  }> {
    // Get modified items
    const { items, libraryVersion } = await this.getItems({ sinceVersion });

    // Get deleted items
    const { data: deleted } = await this.request<string[]>(
      `/deleted?since=${sinceVersion}`
    );

    return {
      items,
      deletedKeys: deleted || [],
      libraryVersion,
    };
  }
}

/**
 * Convert Zotero item to Source data format
 */
export function zoteroItemToSource(item: ZoteroItem): {
  kind: string;
  title: string;
  authorsJson: Array<{ family?: string; given?: string; literal?: string }>;
  year?: number;
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  zoteroKey: string;
} {
  const data = item.data;

  // Map Zotero item type to Source kind
  const kindMap: Record<string, string> = {
    journalArticle: "article",
    bookSection: "book",
    book: "book",
    conferencePaper: "article",
    report: "other",
    thesis: "other",
    webpage: "web",
    blogPost: "web",
    videoRecording: "video",
    audioRecording: "other",
    dataset: "dataset",
    preprint: "article",
  };

  // Convert creators
  const authors = (data.creators || [])
    .filter((c) => c.creatorType === "author")
    .map((c) => {
      if (c.name) return { literal: c.name };
      return { family: c.lastName, given: c.firstName };
    });

  // Extract year from date
  let year: number | undefined;
  if (data.date) {
    const match = data.date.match(/\b(19|20)\d{2}\b/);
    if (match) {
      year = parseInt(match[0], 10);
    }
  }

  return {
    kind: kindMap[data.itemType] || "article",
    title: data.title || "Untitled",
    authorsJson: authors,
    year,
    container: data.publicationTitle,
    volume: data.volume,
    issue: data.issue,
    pages: data.pages,
    doi: data.DOI,
    url: data.url,
    zoteroKey: item.key,
  };
}

/**
 * Convert Source data to Zotero item format
 */
export function sourceToZoteroItem(source: {
  kind: string;
  title?: string | null;
  authorsJson?: unknown;
  year?: number | null;
  container?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
}): Partial<ZoteroItemData> {
  // Map Source kind to Zotero item type
  const typeMap: Record<string, string> = {
    article: "journalArticle",
    book: "book",
    web: "webpage",
    video: "videoRecording",
    dataset: "dataset",
    other: "document",
  };

  // Convert authors
  const authors = source.authorsJson as Array<{ family?: string; given?: string; literal?: string }> | undefined;
  const creators: ZoteroCreator[] = (authors || []).map((a) => {
    if (a.literal) {
      return { creatorType: "author", name: a.literal };
    }
    return {
      creatorType: "author",
      firstName: a.given,
      lastName: a.family,
    };
  });

  return {
    itemType: typeMap[source.kind] || "document",
    title: source.title || "Untitled",
    creators,
    date: source.year ? String(source.year) : undefined,
    publicationTitle: source.container || undefined,
    volume: source.volume || undefined,
    issue: source.issue || undefined,
    pages: source.pages || undefined,
    DOI: source.doi || undefined,
    url: source.url || undefined,
  };
}

/**
 * Create a ZoteroClient from a connection record
 */
export function createZoteroClientFromConnection(connection: {
  apiKey?: string | null;
  libraryType?: string | null;
  libraryId?: string | null;
}): ZoteroClient {
  if (!connection.apiKey) {
    throw new Error("Zotero API key is required");
  }

  return new ZoteroClient({
    apiKey: connection.apiKey,
    libraryType: (connection.libraryType as "user" | "group") || "user",
    libraryId: connection.libraryId || "0",
  });
}
