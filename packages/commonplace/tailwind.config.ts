import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Page titles only (h1, occasional h2). Currently Kolonia Trial.
        display: ["var(--font-display)"],
        // Body — every page of prose, the editor, the article view.
        serif: ["var(--font-serif)"],
        // Labels — nav, metadata strips, buttons, genre chips.
        sans: ["var(--font-sans)"],
      },
      // Overrides for `prose` / `prose-stone` (the @tailwindcss/typography
      // plugin). These apply everywhere prose is used: the editor, the read
      // article, and list snippets. Adjust the three values below.
      typography: {
        DEFAULT: {
          css: {
            // Body text color.
           
            "--tw-prose-body": "#1c1917", // stone-800
            color: "var(--tw-prose-body)",
            // Line height *within* a paragraph (leading).
            lineHeight: "1.7",
            fontSize: "18px",
            // Vertical space *between* paragraphs.
            p: {
              marginTop: ".7em",
              marginBottom: ".7em",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
