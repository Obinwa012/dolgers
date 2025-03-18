'use client'
import React from 'react'
import Logo from './logo/Logo';
import MobileMenuIcon from './mobileMenuIcon/MobileMenuIcon';
import useRightDrawer from '@/stores/rightDrawer/useRightDrawer';
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';

export default function Header() {
  const toggleRightDrawer = useRightDrawer((state) => state.toggleRightDrawer);
  const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);


  const openRightDrawer = () => {
    setRightDrawerType('Log In');
    toggleRightDrawer();
  }

  return (
    <header className='page-wrapper h-[70px] brand-bg-color'>
        <main className='layout-wrapper flex items-center justify-between h-full'>
            

            {/* Left section - Hamburger menu & Logo*/}
            <section className='w-[250px] h-full flex justify-start items-center'>
                <MobileMenuIcon />
                <Logo />
            </section>

            {/* Center section - Search form*/}
            <section className='bg-white-500 h-full'>hi</section>

            {/* Right section*/}
            <section className='bg-green-500 w-[250px] h-full' onClick={() => openRightDrawer()}>right</section>


        </main>
    </header>
  )
}
