/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#110F1A",
        surface: {
          DEFAULT: "#1A1D27",
          elevated: "#242836",
        },
        primary: "#E8ECF4",
        secondary: "#9BA3B5",
        muted: "#5C6379",
        accent: {
          DEFAULT: "#4DA58E",
          muted: "#3A7D6B",
        },
        error: {
          DEFAULT: "#C4555A",
          muted: "#A3444A",
        },
        warning: "#C4945A",
        border: "#2A2E3D",
      },
    },
  },
  plugins: [],
}

