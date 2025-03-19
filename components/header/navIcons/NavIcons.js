'use client'
import React, { useEffect, useState } from 'react'
import ShoppingCart from './ShoppingCart';
import Wishlist from './Wishlist';
import AuthLinks from './AuthLinks';
import Avatar from './Avatar';
import { auth } from '@/libs/firebase/firebase';
import useCustomer from '@/stores/customer/useCustomer';
import { decrypt } from '@/functions/decrypt';
import useRightDrawer from '@/stores/rightDrawer/useRightDrawer';
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';

export default function NavIcons() {
  const customerData = useCustomer((state) => state.customerData);
  const setCustomerData = useCustomer((state) => state.setCustomerData);
  const clearCustomerData = useCustomer((state) => state.clearCustomerData);
  const clearCustomerDataInLocalStorage = useCustomer((state) => state.clearCustomerDataInLocalStorage);
  const localStorageCustomerData = useCustomer((state) => state.localStorageCustomerData);
  const toggleRightDrawer = useRightDrawer((state) => state.toggleRightDrawer);
  const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        setLoading(true);

        try {
            if (user && localStorageCustomerData !== null) {
                const data = await decrypt(localStorageCustomerData);

                if (data !== null) {
                    const sameUser = user.uid === data.customerId;

                    if (sameUser) {
                        setCustomerData(data);
                    } else {
                        clearCustomerData();
                        clearCustomerDataInLocalStorage();
                        auth.signOut();
                    }
                }
            } else if(user && customerData !== null){
            }
        } catch (error) {
            console.error("Error during authentication check:", error);
        } finally {
            setLoading(false);
        }
    });
    return () => unsubscribe();
}, []);

    const openRightDrawer = (link) => {
        setRightDrawerType(link);
        toggleRightDrawer();
    }

  return (
    <main className={`flex items-center justify-end text-white lg:w-[220px]`}>
        <div className={`mr-[32px] hidden ${loading? 'hidden' :  customerData === null? 'hidden' : 'lg:block'}`}><Avatar customerData={customerData}/></div>
        <div className={`mr-[32px] ${loading? 'hidden' :  customerData === null? 'lg:block' : 'hidden'}`}><AuthLinks /></div>
        <div className='mr-[32px]'><Wishlist favorites={customerData !== null? customerData.wishlist : []}/></div>
        <div className='mr-[32px] lg:mr-0'><ShoppingCart cart={customerData !== null? customerData.cart : []}/></div>
        <div className='block lg:hidden' onClick={() => customerData === null? openRightDrawer('Log In') : {}}><Avatar customerData={customerData}/></div>
    </main>
  )
}
