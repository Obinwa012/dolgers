import { create } from "zustand";

const useCustomer = create((set) => ({
    customerData: null,
    localStorageCustomerData: typeof window !== "undefined" && localStorage.getItem("DOLGERS_CUSTOMER") ? JSON.parse(localStorage.getItem("DOLGERS_CUSTOMER")) : null,

    setCustomerData: (newCustomerData)=> {
        set({ customerData : newCustomerData });
    },
    setCustomerDataInLocalStorage: (newCustomerData)=> {
        localStorage.setItem("DOLGERS_CUSTOMER", JSON.stringify(newCustomerData));
        set({ localStorageCustomerData : newCustomerData });
    },


    clearCustomerData: () => {
        set({ customerData : null })
    },
    clearCustomerDataInLocalStorage: () => {
        localStorage.removeItem("DOLGERS_CUSTOMER");
        set({ localStorageCustomerData : null })
    }
}));

export default useCustomer;