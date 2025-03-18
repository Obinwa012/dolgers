import { create } from "zustand";

const useLeftDrawer = create((set) => ({
    isLeftDrawerOpen : false,

    toggleLeftDrawer: () => {
        set((state) => ({ isLeftDrawerOpen: !state.isLeftDrawerOpen }));
    }
    
}));

export default useLeftDrawer;