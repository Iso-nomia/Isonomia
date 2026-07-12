export const isSafeYoutubeEmbed = (url: string) => {
    try {
      const u = new URL(url.trim());
      return (
        ["youtube.com", "www.youtube.com", "youtu.be"].includes(u.hostname) &&
        (u.pathname.startsWith("/embed") || u.hostname === "youtu.be")
      );
    } catch {
      return false;
    }
  };
  
  export const isSafeHttpLink = (url: string) => {
    try {
      const u = new URL(url.trim());
      return ["http:", "https:"].includes(u.protocol);
    } catch {
      return false;
    }
  };
  