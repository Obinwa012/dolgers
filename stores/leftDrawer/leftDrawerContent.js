import { create } from "zustand";

const leftDrawerContent = create((set) => ({
  leftDrawerType: "none",

  setLeftDrawerType: (type) => {
    set({ leftDrawerType: type });
  },
}));

export default leftDrawerContent;