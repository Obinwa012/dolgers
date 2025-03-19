import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';
import useRightDrawer from '@/stores/rightDrawer/useRightDrawer';
import React from 'react'

export default function AuthLinks() {
    const toggleRightDrawer = useRightDrawer((state) => state.toggleRightDrawer);
    const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);
  
  
    const openRightDrawer = (link) => {
      setRightDrawerType(link);
      toggleRightDrawer();
    }

  return (
    <div className={`items-center justify-between text-[12px] hidden lg:flex`}>
        <p className='hover:text-[#f0bd2d] cursor-pointer' onClick={() => openRightDrawer('Log In')}>Log In</p>
        <p className='mx-[12px] cursor-default'>|</p>
        <p className='hover:text-[#f0bd2d] cursor-pointer' onClick={() => openRightDrawer('Sign Up')}>Sign Up</p>
    </div>
  )
}
