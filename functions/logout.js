import { auth } from "@/libs/firebase/firebase";
import useCustomer from "@/stores/customer/useCustomer";

const logout = () => {
  const clearCustomerData = useCustomer((state) => state.clearCustomerData);
  const clearCustomerDataInLocalStorage = useCustomer((state) => state.clearCustomerDataInLocalStorage);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      clearCustomerData();
      clearCustomerDataInLocalStorage();
      return true;
    } catch (error) {
      return false;
    }
  };

  return handleSignOut;
};

export default logout;