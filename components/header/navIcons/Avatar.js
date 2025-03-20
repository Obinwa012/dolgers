'use client'
import Link from 'next/link';
import React, { useState } from 'react'
import { auth } from '@/libs/firebase/firebase';
import useCustomer from '@/stores/customer/useCustomer';

export default function Avatar({ customerData }) {
    const [profileLink, openProfileLink] = useState(false);
    const clearCustomerData = useCustomer((state) => state.clearCustomerData);
    const clearCustomerDataInLocalStorage = useCustomer((state) => state.clearCustomerDataInLocalStorage);

    const handleSignOut = () => {
        try{
            auth.signOut();
            clearCustomerData();
            clearCustomerDataInLocalStorage();
        }catch(e){
            auth.signOut();
        }
    }

  return (
    <div className='relative cursor-pointer' onMouseEnter={()=> openProfileLink(true)} onMouseLeave={()=> openProfileLink(false)}>
        <div className={`w-[32px] h-[63px] bg-transparent absolute top-0 left-0 ${profileLink? 'max-lg:hidden lg:block' : 'hidden'}`}></div>
        <div className="avatar avatar-placeholder hover:scale-105 cursor-pointer">
            <div className="bg-gray-600 text-neutral-content w-[32px] rounded-full">
                <span className="text-xs">{customerData == null? 'DG' : customerData.name.slice(0,2).toString().toUpperCase()}</span>
            </div>
        </div>
        <div className={`clip-triangle absolute top-[36px] right-0 w-[32px] h-[32px] bg-white border-[#fafafa] shadow-lg ${profileLink? 'max-lg:hidden lg:block' : 'hidden'}`}></div>
        <div className={`absolute top-[51px] right-1/2 transform translate-x-1/2 w-[190px] rounded-md border-t-0 border border-gray-100 shadow-md bg-white overflow-hidden ${profileLink ? 'max-lg:hidden lg:block' : 'hidden'}`}>
            <div className={`py-8 px-4`}>
                {
                    customerData && (
                    <div className="text-center mb-3">
                        <p className="text-sm font-semibold  text-gray-700">Hi! {customerData.name}</p>
                        <button className="mt-3 w-full py-2 px-4  brand-accent-bg-color hover:bg-[#00233d] text-sm font-medium rounded-md transition-colors duration-200">View Profile</button>
                    </div>
                    )
                }

                <hr className="border-t border-gray-100 my-4" />

                <nav className="space-y-1">
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">My Orders</p>
                    </Link>
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">Returns & Refunds</p>
                    </Link>
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">
                        Saved Addresses
                        </p>
                    </Link>
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">
                        Payment Methods
                        </p>
                    </Link>
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">
                        Coupons & Promotions
                        </p>
                    </Link>
                    <Link href="#" className="flex justify-center">
                        <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">
                        Recently Viewed
                        </p>
                    </Link>
                </nav>

                <hr className="border-t border-gray-100 my-4" />

                <nav className="space-y-1">
                <Link href="#" className="flex justify-center">
                    <p className="py-2 px-4 text-sm text-gray-700 hover:scale-105 transition-colors duration-200">Get Help</p>
                </Link>
                <div className="flex justify-center">
                    <p className="py-2 px-4 text-sm text-[#ff3300] font-medium hover:scale-105" onClick={()=> handleSignOut()}>Log Out</p>
                </div>
                </nav>
            </div>
        </div>    
    </div>
  )
}
