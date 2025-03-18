import { create } from "zustand";

const rightDrawerContent = create((set) => ({
  rightDrawerType: "none",

  setRightDrawerType: (type) => {
    set({ rightDrawerType: type });
  },
}));

export default rightDrawerContent;