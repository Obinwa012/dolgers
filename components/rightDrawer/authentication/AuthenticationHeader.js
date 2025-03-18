import React from 'react'
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';

export default function AuthenticationHeader() {
    const rightDrawerType = rightDrawerContent((state) => state.rightDrawerType);
    const subTitle = ['Enjoy a personalized shopping experience, track your orders, save favorite items, and more.','Unlock faster checkouts, exclusive offers, personalized recommendations, and more.',"Enter your account email address, and we'll send you a link to reset your password.",]

  return (
    <div className='w-full mt-[70px] flex flex-col justify-center items-center'>
        <h1 className='text-[24px] font-bold'>{rightDrawerType}</h1>
        <p className='text-center px-[15%] mt-[15px] text-gray-500'>{rightDrawerType === "Log In"? subTitle[0] : rightDrawerType === "Sign Up"? subTitle[1] : rightDrawerType === "Reset Password"? subTitle[2] : ''}</p>
    </div>
  )
}
