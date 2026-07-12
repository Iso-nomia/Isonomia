/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    './app/**/*.{tsx,ts,jsx,js}', 
    './components/**/*.{tsx,ts,jsx,js}',
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    
    extend: {
      
      colors: {
        "primary-500": "#475569",
        "secondary-500": "#FFB620",
        "blue": "#d3edf7",
                "blue-50": "#d3edf7",
                "blue-100": "#accbd7ff",
"blue-200": "#81a0bcff",
"blue-300": "#76b1c9ff",
"blue-400": "#5697c2ff",
"blue-500": "#57aacaff",
"blue-600": "#3ea0c6ff",
"blue-700": "#3694baff",
"blue-800": "#175a74ff",
"blue-900": "#084057ff",
        "logout-btn": "#FF5A5A",
        "navbar-menu": "rgba(16, 16, 18, 0.6)",
        "dark-1": "#c5c9d8",
        "dark-2": "#121417",
        "dark-3": "#101012",
        "dark-4": "#1F1F22",
        "light-1": "#FFFFFF",
        "light-2": "#e4e5f1",
        "light-3": "#7878A3",
        "light-4": "#4c51bf",
        "gray-1": "#697C89",
        "white-1": "#CCCCCC",
        glassmorphism: "rgba(16, 16, 18, 0.60)",
      },
      boxShadow: {
        "count-badge": "0px 0px 6px 2px rgba(219, 188, 159, 0.30)",
        "groups-sidebar": "-30px 0px 60px 0px rgba(28, 28, 31, 0.50)",
      },
      screens: {
        xs: "400px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },

    fontSize: {
      "heading1-bold": [
        "48px",
        {
          lineHeight: "140%",
          fontWeight: "700",
        },
      ],
      "heading1-semibold": [
        "36px",
        {
          lineHeight: "140%",
          fontWeight: "600",
        },
      ],
      "heading2-bold": [
        "40px",
        {
          lineHeight: "140%",
          fontWeight: "700",
        },
      ],
      "heading2-semibold": [
        "30px",
        {
          lineHeight: "140%",
          fontWeight: "600",
        },
      ],
      "heading3-bold": [
        "24px",
        {
          lineHeight: "140%",
          fontWeight: "700",
        },
      ],
      "heading4-medium": [
        "20px",
        {
          lineHeight: "140%",
          fontWeight: "500",
        },
      ],
      "body-bold": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "700",
        },
      ],
      "body-semibold": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "600",
        },
      ],
      "body-medium": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "500",
        },
      ],
      "body-normal": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "400",
        },
      ],
      "body1-bold": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "700",
        },
      ],
      "base-regular": [
        "18px",
        {
          lineHeight: "150%",
          fontWeight: "400",
        },
      ],
      "base-medium": [
        "18px",
        {
          lineHeight: "150%",
          fontWeight: "500",
        },
      ],
      "base-semibold": [
        "18px",
        {
          lineHeight: "150%",
          fontWeight: "600",
        },
      ],
      "base1-semibold": [
        "18px",
        {
          lineHeight: "140%",
          fontWeight: "600",
        },
      ],
      "small-regular": [
        "16px",
        {
          lineHeight: "150%",
          fontWeight: "400",
        },
      ],
      "small-medium": [
        "16px",
        {
          lineHeight: "150%",
          fontWeight: "400",
        },
      ],
      "small-semibold": [
        "16px",
        {
          lineHeight: "150%",
          fontWeight: "600",
        },
      ],
      "subtle-medium": [
        "14px",
        {
          lineHeight: "16px",
          fontWeight: "500",
        },
      ],
      "subtle-semibold": [
        "14px",
        {
          lineHeight: "16px",
          fontWeight: "600",
        },
      ],
      "tiny-medium": [
        "10px",
        {
          lineHeight: "140%",
          fontWeight: "500",
        },
      ],
      "x-small-semibold": [
        "7px",
        {
          lineHeight: "9.318px",
          fontWeight: "600",
        },
      ],
    },
    },
  },
  plugins: [require("tailwindcss-animate"),('@tailwindcss/typography')],
};
