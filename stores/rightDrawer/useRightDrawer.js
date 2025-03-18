import { create } from "zustand";

const useRightDrawer = create((set) => ({
    isRightDrawerOpen : false,

    toggleRightDrawer: () => {
        set((state) => ({ isRightDrawerOpen: !state.isRightDrawerOpen }));
    }
    
}));

export default useRightDrawer;