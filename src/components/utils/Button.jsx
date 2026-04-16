import React from "react";

export default function Button({ children, onClick, icon }) {
  return (
    <button
      className="rounded-full border-3 border-blue-950 text-blue-950 hover:bg-blue-950 hover:text-white transition duration-300 font-medium py-2 px-4"
      onClick={onClick}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
