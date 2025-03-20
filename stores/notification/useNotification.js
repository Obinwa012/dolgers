import { create } from "zustand";

const useNotification = create((set) => ({
    isNotificationOpen : false,
    notificationType: 'none',
    notificationContent: null,
    toggleNotification: () => {
        set((state) => ({ isNotificationOpen: !state.isNotificationOpen }));
    },

    setNotificationType: (type) => {
        set({ notificationType: type });
    },

    setNotificationContent: (content) => {
        set({ notificationContent: content });
    },
    
}));

export default useNotification;