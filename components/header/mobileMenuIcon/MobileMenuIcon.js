'use client'
import React from 'react'
import { PiListBold } from "react-icons/pi";
import useLeftDrawer from '@/stores/leftDrawer/useLeftDrawer';
import leftDrawerContent from '@/stores/leftDrawer/leftDrawerContent';



export default function MobileMenuIcon() {
  const toggleLeftDrawer = useLeftDrawer((state) => state.toggleLeftDrawer);
  const setLeftDrawerType = leftDrawerContent((state) => state.setLeftDrawerType);

  const openLeftDrawer = () => {
    setLeftDrawerType('mobileMenu');
    toggleLeftDrawer();
  }


  return (
    <PiListBold className='dolgers-title cursor-pointer md:hidden text-white' onClick={() => openLeftDrawer()}/>
  )
}
