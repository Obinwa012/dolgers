'use client'
import React from 'react'
import Logo from './logo/Logo';
import MobileMenuIcon from './mobileMenuIcon/MobileMenuIcon';
import NavIcons from './navIcons/NavIcons';

export default function Header() {

  return (
    <header className='page-wrapper h-[70px] brand-bg-color'>
        <main className='layout-wrapper flex items-center justify-between h-full'>
            

            {/* Left section - Hamburger menu & Logo*/}
            <section className='h-full flex justify-start items-center'>
                <MobileMenuIcon />
                <Logo />
            </section>

            {/* Center section - Search form*/}
            <section className='bg-white-500 h-[40px] hidden md:block flex-grow bg-white md:mx-[40px] lg:mx-[60px] xl:mx-[80px] 2xl:mx-[100px] rounded-md'>hi</section>

            {/* Right section*/}
            <NavIcons />
        </main>
    </header>
  )
}
